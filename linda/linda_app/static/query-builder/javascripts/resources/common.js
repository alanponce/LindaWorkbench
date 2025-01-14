function get_server_address() {
  return window.location.protocol + "//" + window.location.host;
};

function show_loading() {
  return $("#loading").show();
};

function hide_loading() {
  return $("#loading").hide();
};

function html_safe(str) {
  if (str !== void 0) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  } else {
    return "";
  }
};

function break_words(str) {
  var i, j, new_word, result, words;
  words = str.split(" ");
  result = "";
  i = 0;
  while (i < words.length) {
    if (words[i].length > 50) {
      new_word = "";
      j = 0;
      while (j < words[i].length) {
        if (j > 0) {
          new_word += "- ";
        }
        new_word += words[i].substring(j, j + 40);
        j = j + 40;
      }
      words[i] = new_word;
    }
    if (i > 0) {
      result += " ";
    }
    result += words[i];
    i++;
  }
  return result;
};

$(document).ready(function() {
  $('.dropdown-toggle').dropdown();
});

function truncate(string, length, o)
{
  if(string.length <= length){
    return string;
  }
  else{
    return string.substring(0,length)+o;
  }
}

function get_long_number_display(long_number){
  if(long_number/1000000000 > 1)
    return (Number((long_number/1000000000).toFixed(1))).toString()+"B";
  else if(long_number/1000000 > 1)
    return (Number((long_number/1000000).toFixed(1))).toString()+"M";
  else if(long_number/1000 > 1)
    return (Number((long_number/1000).toFixed(1))).toString()+"K";
  else
    return long_number.toString();
}

function get_random_int(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function get_file_extension(file_name){
  return file_name.split(".")[file_name.split(".").length-1];
}

String.prototype.splice = function( idx, rem, s ) {
    return (this.slice(0,idx) + s + this.slice(idx + Math.abs(rem)));
};

String.prototype.toDash = function(){
  return this.replace(/([A-Z])/g, function($1){return "-"+$1.toLowerCase();});
};

String.prototype.toUnderscore = function(){
  return this.replace(/([A-Z])/g, function($1){return "_"+$1.toLowerCase();});
};

