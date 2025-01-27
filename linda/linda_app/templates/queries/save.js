        {% if query %}
            var query_object = {id: {{query.id}}, description: '{{query.description}}'};
        {% else %}
            var query_object = undefined;
        {% endif %}

            function save_query_object(desc, designer) {
                var post_url = "/query-builder/save/";
                if (query_object) {
                    post_url += query_object.id + '/'
                }

                var q_data = {
                    endpoint: endpoint_uri,
                    query: editor.getSession().getValue(),
                    csrfmiddlewaretoken: '{{ csrf_token }}',
                    description: desc
                };
                if (designer === true) {
                    q_data.design = JSON.stringify( builder_workbench.to_json() );
                }

                $.ajax({
                    url: post_url,
                    type: "POST",
                    data: q_data,
                    success: function(data, textStatus, jqXHR)
                    {
                        query_object = {id: data.id, description: data.description};
                        $("#alert_modal .modal-title").html('LinDA Queries');
                        $("#alert_modal .modal-body").html('Query saved');
                        $("#alert_modal .modal-footer .btn-default").html('Close');
                        $("#alert_modal").show();
                        if (typeof(builder) !== "undefined") {
                            builder.saved_query = builder.query;
                        }

                        //query title
                        $('.designer-menu .query-title').html('#' + data.id + ': ' + data.description);
                        //analytics
                        $('.designer-menu a.analytics').attr('href', '/analytics?q_id=' + data.id);
                        $('.designer-menu a.analytics').removeClass('hidden');
                        //visualization
                        $('.designer-menu a.visualization').attr('href', '/query/' + data.id + '/visualize/');
                        $('.designer-menu a.visualization').removeClass('hidden');
                    },
                    error: function (jqXHR, textStatus, errorThrown)
                    {
                        $("#alert_modal .modal-title").html('Error');
                        $("#alert_modal .modal-body").html(jqXHR.responseText);
                        $("#alert_modal .modal-footer .btn-default").html('OK');
                        $("#alert_modal").show();
                    }
                });
            }

            function save_query(designer) {
                var q = editor.getSession().getValue();
                if ((typeof(dt_name) === "undefined") || q == "") {
                    $("#alert_modal .modal-title").html('Error');
                    $("#alert_modal .modal-body").html('The base datasource and the query text must not be empty.');
                    $("#alert_modal .modal-footer .btn-default").html('OK');

                    $("#alert_modal").show();
                    return;
                }
                if (!query_object) { //get the default description
                    $.ajax({
                        url: "/api/queries/default-description?datasource=" + dt_name + "&query=" + encodeURIComponent(q),
                        type: "GET",
                        success: function(data, textStatus, jqXHR) { //show alert to change the default description
                            var description = data.description;

                            $("#alert_modal .modal-title").html('LinDA Queries');

                            var designer_inp = '';
                            if (designer) { //to indicate if the design should be saved
                                designer_inp = '<span class="designer"></span>';
                            }
                            $("#alert_modal .modal-body").html('Give the query description:<br /><input type="text" class="description" value="' + description + '"/>' + designer_inp);

                            $("#alert_modal .modal-footer .btn-default").addClass('query-save');
                            $("#alert_modal .modal-footer .btn-default").html('Save');

                            $("#alert_modal").show();
                        },
                        error: function (jqXHR, textStatus, errorThrown)
                        {
                            alert(textStatus + ': ' + errorThrown);
                        }
                    });
                } else {
                    save_query_object(query_object.description, designer);
                }
            }

            /*Save the query with the description*/
            $("body").on('click', "#alert_modal .modal-footer .btn-default.query-save", function() {
                $(this).removeClass('query-save');
                var val = $(this).closest(".modal-content").find(".modal-body input.description").val();
                var designer = $(this).closest(".modal-content").find(".modal-body span.designer").length > 0;
                save_query_object(val, designer);
            });