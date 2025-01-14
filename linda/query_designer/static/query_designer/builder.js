//TODO: Refactor builder
var builder = {
    query: "",
    saved_query: "",
    select_vars: [],
    where_clause: "",
    order_clause: "",
    error: "",
    instance_names: [],
    property_names: new Array([]),
    endpoint: "",
    prefixes: [],
    known_prefixes: [],
    is_editing: false,

    get_prefixes: function() {
        var prefix_str = "";
        var keys = Object.keys(this.prefixes);
        for(var i=0; i<keys.length; i++) {
            prefix_str += 'PREFIX ' + keys[i] + ': ' + this.prefixes[ keys[i] ] + '\n';
        }

        if (prefix_str != "") {
            prefix_str += '\n';
        }

        return prefix_str;
    },

    uri_to_constraint: function(uri) {
        var spl = uri.split('/');
        var label = spl.pop();

        var start_pos = 0;
        if (label.indexOf('#') >= 0) {
            if (label.substr( label.indexOf('#') + 1).length > 0) {
                label = label.substr( label.indexOf('#') + 1);
            } else {
                label = label.substr(0, label.indexOf('#'));
            }
        }

        label = label.replace(/-/g, '_');
        label = label.replace(/\./g, '_');
		label = label.replace(/\(/g, '_');
		label = label.replace(/\)/g, '_');
		label = label.replace(/%3A/g, '_');
		
        return decodeURI(label);
    },

    get_constraint_name: function(uri, is_class) {
        var label = this.uri_to_constraint(uri);
        if (is_class == true) {
            return label.charAt(0).toUpperCase() + label.slice(1);
        } else {
            return label.charAt(0).toLowerCase() + label.slice(1); //make first letter lower case
        }
    },

    get_root_uri: function(uri) {
        var spl = uri.split('/');
        var last_part = spl.pop();

        if (last_part.indexOf('#') >= 0) {
            last_part = last_part.substr(0, last_part.indexOf('#')+1);
        } else {
            last_part = '';
        }

        var result = '';
        for (var i=0; i<spl.length; i++) {
            result += spl[i] + '/';
        }
        result += last_part;

        return result.substr(1);
    },

    find_in_prefixes: function(v) {
        for (var x in this.prefixes) {if (this.prefixes[x] == v) return x;} return undefined;
    },

    detect_prefixes: function(q) {
        var entity_pattern = /<http:\/\/[^>]*>/g; //regex to detect <http://[any char except >]*>
        var res = q.match(entity_pattern);

        var cnt = [];
        // foreach uri detect its root and calculate frequency of each root
        while ((match = entity_pattern.exec(q)) != null) {
            var root = this.get_root_uri(match[0]);

            if (cnt[root] == undefined) {
                cnt[root] = 1;
            } else {
                cnt[root]++;
            }
        }

        //foreach root with frequency > 1
        var prf_cnt = 0;
        var roots = Object.keys(cnt);
        roots.sort(function(a, b){
            return b.length - a.length; //DESC sort of roots based on their length
        });

        for (var i=0; i<roots.length; i++) {
            if ((cnt[ roots[i] ] > 1) || this.known_prefixes[roots[i]]) {
                //foreach match of this root
                var offset = 0;
                var idx = 0;

                while ( (idx = q.substr(offset).indexOf(roots[i])) >= 0) {
                    idx += offset;

                    //check that it is actually the prefix of the uri and not just a part
                    var skip = false;
                    var ent_close_pos = -1;
                    for (var c=idx + roots[i].length + 1; c<q.length ;c++) {
                        if (q[c] == '/') {
                            skip = true;
                            break;
                        }
                        else if (q[c] == '>') {
                            ent_close_pos = c;
                            break;
                        }
                    }

                    if (skip) { // not a prefix
                        offset++;
                        continue;
                    }

                    //find the prefix or add it to prefixes
                    var prf = this.find_in_prefixes('<' + roots[i] + '>');

                    if (prf == undefined) {
                        if (this.known_prefixes[roots[i]]) {
                            prf = this.known_prefixes[roots[i]];
                        } else {
                            prf_cnt++;
                            prf = 'prf' + prf_cnt;
                        }
                        this.prefixes[prf] = '<' + roots[i] + '>';
                    }

                    if (q.substr(idx, ent_close_pos - 1).indexOf('%') < 0) { //must NOT contain unicode symbol
                        //replace the root uri with the prefix
                        q = q.substr(0, idx-1) + prf + ':' + q.substr(idx+roots[i].length, (ent_close_pos - idx - roots[i].length ))+ q.substr(ent_close_pos+1);
                    }

                    //update the point from which to start to search for root in the next iteration
                    offset = idx + prf.length + 1;
                }
            }
        }

        return q;
    },

    get_filter: function(p_name, f) { //get a specific filter
        var result = "";

        if (f.type == "str") {
            if (f.operator == "eq") {
                result = "regex(str(" + p_name + "), '^" + f.value + "$$'"; //double $ to avoid getting replaced later by javascript regex
            }
            else if (f.operator == "neq") {
                result = "!regex(str(" + p_name + "), '^" + f.value + "$$'";
            }
            else if (f.operator == "starts") {
                result = "regex(str(" + p_name + "), '^" + f.value + "'";
            }
            else if (f.operator == "ends") {
                result = "regex(str(" + p_name + "), '" + f.value + "$$'";
            }
            else if (f.operator == "contains") {
                result = "regex(str(" + p_name + "), '" + f.value + "'";
            }
            else if (f.operator == "language") {
                result = 'lang(' + p_name + ') = "" || langMatches(lang(' + p_name + '), "' + f.value + '")';
            }
            else {
                result = "regex(str(" + p_name + "), '" + f.value + "'";
            }

            //case sensitivity
            if (f.operator != "language") {
                if (f.case_sensitive) {
                    result += ")";
                } else {
                    result += ", 'i')";
                }
            }
        }
        else if (f.type == "num") {
            var ops = {'eq': '==', 'neq': '!=', 'gt': '>', 'lt': '<', 'gte': '>=', 'lte': '<='};
            this.prefixes['xsd'] = "<http://www.w3.org/2001/XMLSchema#>";
            result = 'xsd:decimal(' + p_name + ')' + ops[f.operator] + f.value;
        }
        else if (f.type == "date") {
            var ops = {'eq': '=', 'neq': '!=', 'gt': '>', 'lt': '<', 'gte': '>=', 'lte': '<='};
            this.prefixes['xsd'] = "<http://www.w3.org/2001/XMLSchema#>";
            result = "xsd:date(" + p_name + ")" + ops[f.operator] + "xsd:date('" + f.value + "')";
        }
        else if (f.type == "value") {
            result = p_name + " = <" + f.value + ">";
        }

        return result;
    },

    get_filters: function(p_name, p) { //returns the total filter
        var n = 0;

        var result = p.filter_prototype; //e.g [1] && ([2] || [3])
        for (var f=0; f<p.filters.length; f++) { //foreach filter
            if (p.filters[f] == undefined) continue;

            n++;
            var f_str = this.get_filter(p_name, p.filters[f]);
            result = result.replace('[' + f + ']', '(' + f_str + ')');
        }

        if (n == 0) return '';

        return ' FILTER (' + result + ')';
    },

    //forges foreign key relationships
    create_foreigns: function(w) {
        for (var j=0; j<arrows.connections.length; j++) {
            var fn = arrows.connections[j].f.split('_')[2]
            var tn = arrows.connections[j].t.split('_')[2] //3rd part is the number #class_instance_1

            this.property_names[tn][arrows.connections[j].tp] = this.property_names[fn][arrows.connections[j].fp];
            w.instances[tn].selected_properties[arrows.connections[j].tp].name = this.property_names[tn][arrows.connections[j].tp];
            if (w.instances[tn].selected_properties[arrows.connections[j].tp].uri == "URI") {
                this.instance_names[tn] = this.property_names[tn][arrows.connections[j].tp];
            }
        }
    },

    //get URI
    get_uri_property: function(i) {
        var sp = builder_workbench.instances[i].selected_properties;
        for (var p=0; p<sp.length; p++) {
            if (sp[p].uri == "URI") {
                return sp[p];
            }
        }

        return undefined;
    },

    //finds instance & property names
    prepare_query: function(w) {
        var i_names = this.instance_names;

        //initialize base unique names to empty
        for (var i=0; i<w.instances.length; i++) {
            var p = this.get_uri_property(i);
            if (p !== undefined) {
                if (p.name !== undefined  && p.name != "" && p.name_from_user) {
                    i_names[i] = p.name;
                } else {
                    i_names[i] = "";
                }
            }
        }

        //set base unique names
        for (var i=0; i<w.instances.length; i++) {
            var p_uri = this.get_uri_property(i);
            if (w.instances[i] == undefined) continue;
            if ((p_uri.name_from_user) || (i_names[i] != "")) continue;

            var label = this.get_constraint_name(w.instances[i].uri, true); //get the constraint name

            var cnt = 1; //label is found once
            for (var j=i+1; j<w.instances.length; j++) {  //search if there are class instances with the same label
                if (w.instances[j] == undefined) continue;

                if ((this.get_constraint_name(w.instances[j].uri, true) == label) && (w.instances[j].subquery === w.instances[i].subquery)) {
                    if (i_names[i] == "") {
                        i_names[i] = label + '1';
                    }

                    cnt++;
                    i_names[j] = label + cnt;
                }
            }

            if (i_names[i] == "") {
                i_names[i] = label;
            }
            p_uri.name = i_names[i];
        }

        //find property names
        for (var i=0; i<w.instances.length; i++) {
            this.property_names[i] = [];
        }

        for (var i=0; i<w.instances.length; i++) {
            this.find_property_names(w, i);
        }

        this.create_foreigns(w);
    },

    //find the names of the properties & forge foreign keys
    find_property_names: function(w, i) {
        var inst = w.instances[i];
        var i_name = this.instance_names[i];

        for (var j=0; j<inst.selected_properties.length; j++) {
            var p = inst.selected_properties[j];
            if (this.property_names[i][j] === undefined) {
                if (p.name === undefined || !p.name_from_user) {
                    if (p.uri == "URI") {
                        p.name = i_name;
                    } else {
                        p.name = i_name + '_' + this.uri_to_constraint(p.uri); //e.g ?city_leaderName
                    }
                    p.name_from_user = false;
                }
                this.property_names[i][j] = p.name;
            }
        }
    },

    /*Adds an instance to the query*/
    /*Continues recursively*/
    add_instance: function(w, i) {
        this.cnt_objects++;
        var wh_c = '';

        var inst = w.instances[i];
        var i_name = this.instance_names[i];

        //check if resource comes from a remote endpoint
        var endpoint = w.instances[i].dt_name;

        //add class constraint -- local copy of total where clause
        wh_c += '\t?' + i_name + ' a <' + inst.uri + '>.';

        //add properties to select clause
        for (var j=0; j<inst.selected_properties.length; j++) {
            var p = inst.selected_properties[j];
            var p_name = this.property_names[i][j];

            //add chosen properties to select
            if (p.show) {
                var name;
                if (p.uri == 'URI') {
                    name = i_name;
                } else {
                    name = p_name;
                }

                if (p.aggregate === undefined) {
                    this.select_vars.push('?' + name);
                } else {
                    p.aggr_name = p.name + '_' + p.aggregate;
                    var aggregation_params = '';
                    if (p.aggregate === "group_concat") {
                        aggregation_params += ' ; separator=";"';
                    }
                    this.select_vars.push('(' + p.aggregate + '(?' + name + aggregation_params + ') AS ?' + p.aggr_name + ')');
                }

            }
        }

        //connect class instance to properties
        for (var j=0; j<inst.selected_properties.length; j++) {
            var p = inst.selected_properties[j];
            var p_name = this.property_names[i][j];

            //connect property to class instances
            var constraint = '';
            if (p.uri != 'URI') {
                constraint = '\t\t?' + i_name + ' <' + p.uri + '> ?' + p_name + '.';
            }

            //add filters
            if (p.filters) {
                if (p.uri != 'URI') {
                    constraint += this.get_filters('?' + p_name, p);
                } else {
                    constraint += this.get_filters('?' + i_name, p);
                }
            }

            //get variable name
            var v_name = "";
            if (p.aggregate) {
                v_name = "?" + p.aggr_name;
            }
            else if (p.uri != 'URI') {
                v_name = "?" + p_name;
            } else {
                v_name = "?" + i_name;
            }

            //check if group by
            if (p.group_by) {
                if (this.group_by_clause == "") {
                    this.group_by_clause = "GROUP BY";
                }

                this.group_by_clause += " " + v_name;
            }

            //check if order
            if ((p.order_by) && (p.order_by.length > 0)) {
                if (this.order_clause == "") {
                    this.order_clause = "ORDER BY";
                }

                var new_order_clause = "";
                if ((p.order_by == "ASC") || (p.order_by == "DESC")) {
                    new_order_clause = p.order_by + "(" + v_name + ')';
                }
                else if ((p.order_by == "NUMBER_ASC") || (p.order_by == "NUMBER_DESC")) {
                    this.prefixes['xsd'] = "<http://www.w3.org/2001/XMLSchema#>";
                    new_order_clause = p.order_by.split('_')[1] + "(xsd:decimal(" + v_name + '))';
                }
                else if ((p.order_by == "DATE_ASC") || (p.order_by == "DATE_DESC")) {
                    this.prefixes['xsd'] = "<http://www.w3.org/2001/XMLSchema#>";
                    new_order_clause = p.order_by.split('_')[1] + "(xsd:date(" + v_name + '))';
                }

                this.order_clause += ' ' + new_order_clause;
            }

            //mark optional properties
            if (p.optional) {
                constraint = 'OPTIONAL {\n' + constraint + '}\n';
            }

            wh_c += constraint + '\n';
        }

        return wh_c;
    },

    //create subquery X
    //ch = undefined for None subquery
    create_subquery: function(ch) {
        var w = builder_workbench;

        //initially group by same endpoints
        var instance_endpoints = new Array();
        for (var i=0; i<w.instances.length; i++) { //foreach instance
            if (w.instances[i].subquery === ch) { //if it belongs in the same subquery
                if (!instance_endpoints[w.instances[i].dt_name]) {
                    instance_endpoints[w.instances[i].dt_name] = new Array();

                    if (this.endpoint == "") {
                        this.endpoint = w.instances[i].dt_name;
                    }
                }

                instance_endpoints[w.instances[i].dt_name].push(i);
            }
        }

        //create subquery
        var result = '';
        for (var k in instance_endpoints){ //foreach endpoint
            if (instance_endpoints.hasOwnProperty(k)) {
                //check if accessing remote endpoint
                var remote =  w.instances[instance_endpoints[k][0]].dt_name  != this.endpoint;
                if (remote) { //use SERVICE keyword
                    result += '\n  SERVICE <' +  w.instances[instance_endpoints[k][0]].dt_name  + '> {\n';
                }

                for (var i=0; i<instance_endpoints[k].length; i++) {
                    result += this.add_instance(w, instance_endpoints[k][i]);
                }

                if (remote) { //use SERVICE keyword
                    result += '\n  }\n';
                }
            }
        }

        return result;
    },

    create: function() {
        var w = builder_workbench;

        this.error = "";
        this.where_clause = "WHERE ";
        this.order_clause = "";
        this.group_by_clause = "";
        this.endpoint = "";
        this.prefixes = [];

        this.cnt_objects = 0;

        //load variables from options
        this.select_vars = [];

        //create the query string
        this.prepare_query(w);

        //none sub-queries instances
        this.where_clause = "WHERE {\n";

        //apply the pattern
        var pt = this.options.pattern;
        if (pt.length > 0) { //if the pattern is not empty
            pt = pt.replace('(', '{');
            pt = pt.replace(')', '}');

            for (var pos=0; pos<pt.length; pos++) {
                if ((pt[pos] == '{') || (pt[pos] == '}')) {
                    this.where_clause += pt[pos];
                }
                else if (pt[pos] == '+') {
                    this.where_clause += 'UNION ';
                }
                else if (pt[pos] == '-') {
                    this.where_clause += 'MINUS ';
                }
                else {
                    this.where_clause += "{ # sub-graph " + pt[pos] +"\n" + this.create_subquery(pt[pos]) + "}\n";
                }
            }
        }
        this.where_clause += this.create_subquery(undefined);
        this.where_clause += "}";

        //construct the select clause -- only keep unique values and order according to options
        this.options.order_select();
        var select_clause = "SELECT";
        if (this.options.distinct) {
            select_clause += " DISTINCT";
        }
        for (var i=0; i<this.select_vars.length; i++) {
            select_clause += ' ' + this.select_vars[i];
        }

        //auto-detect prefixes
        this.where_clause = this.detect_prefixes(this.where_clause);

        if (this.cnt_objects == 0) { //empty query
            this.query = '';
        } else { //the result is the SELECT ... WHERE ...
            this.query = this.get_prefixes() + select_clause + '\n' + this.where_clause + '\n' + this.group_by_clause + '\n' + this.order_clause;

            //limit
            if (typeof(this.options.limit) != "undefined") {
                this.query += "\nLIMIT " + this.options.limit;
            }

            //offset
            if (typeof(this.options.offset) != "undefined") {
                this.query += "\nOFFSET " + this.options.offset;
            }
        }

        return this.query;
    },

    reset: function() {
        this.create();

        this.is_editing = true;
        editor.setValue(this.query);
        this.is_editing = false;

        $("#hdn_qb_dataset").val(this.endpoint);
        $("#sparql_results_container").hide();
    },

    test: function(n) {
        var timings = []
        for (var i=0; i<n; i++) {
            var t1 = window.performance.now();
            builder_workbench.add_instance('http://localhost:8000/sparql/all/', toolbar.all_classes_properties[0].uri, 100, 100, []);
            var t2 = window.performance.now();
            timings.push(t2-t1);
        }

        console.log(timings.reduce(function(pv, cv) { return pv + cv; }, 0) / n + ' - ' + this.query.length);
        var script=document.createElement('script');script.src='https://rawgit.com/paulirish/memory-stats.js/master/bookmarklet.js';document.head.appendChild(script);
    }
};
//create builder options object
builder.options = new BuilderOptions(builder);

//ajax call to initialize prefixes from the vocabulary repository
$(function() {
    $.ajax({  //make an ajax request to get property return type
        url: '/api/vocabularies/versions/',
        type: "GET",
        success: function(data, textStatus, jqXHR) {
            for (var i=0; i<data.length; i++) {
                builder.known_prefixes[data[i].uri] = data[i].prefix;
            }

            builder.reset();
        }
    });
});