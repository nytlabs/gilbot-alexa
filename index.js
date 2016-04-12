var alexa = require('alexa-app');
var Levenshtein = require('levenshtein');
var omdb = require('omdb');
var fs = require('fs');
var phrases = JSON.parse(fs.readFileSync('phrases.json', 'utf8'));
var phr = require('pickPhrase')(phrases);

var app = new alexa.app();
var knowledge = JSON.parse(fs.readFileSync('knowledge.json', 'utf8'));

app.launch(function(request,response) {
    response.session ('open_session', 'true');
	response.say(phr.say("ready") + " " + phr.say("help_reprompt"));
    //select a random "tool" to start
	response.shouldEndSession (false, phr.say("reprompt") + " " + phr.say("help_reprompt"));
});

var names = []
for (p in knowledge.plays) {
    names.push(knowledge.plays[p].spokentitle);
}

app.dictionary = {
    "movie_names": names,
    "genres": ["Action","Adult","Adventure","Animation","Biography","Comedy","Crime","Documentary","Drama","Family","Fantasy","Film-Noir","History","Horror","Music","Musical","Mystery","News","Romance","Sci-Fi","Short","Sport","Thriller","War","Western"]
};

app.intent('StartIntent',
    {
        "slots": {},
        "utterances":[
            "What should I watch",
            "What's good",
            "What's on",
            "I'm bored"
        ]
    },
    function (request, response) {
        console.log("[StartIntent]");
        response.say(phr.say("opener") + " " + phr.say("last_thing_watched"));
        response.shouldEndSession (false);
        response.send();
    }
);

app.intent('FavoriteIntent', 
    {
        "slots": {"TITLE":"LITERAL"},
        "utterances": [
            "I {really |}{liked |loved |love |like }{the movie |the show |}{movie_names|TITLE}",
            "How about {the movie |the show |}{movie_names|TITLE}",
            "What {show|movie|film|program} is {something |}{similar |most like |comparable to |like }{movie_names|TITLE}",
            "{What is|What's} something {that is|that's} like {movie_names|TITLE}"
        ]
    },
    function (request, response) {
        console.log ("[FavoriteIntent]");
        filter_movie (response, request.slot('TITLE'));
    }
);

app.intent('GenreIntent',
    {
        "slots": {"GENRE":"LITERAL"},
        "utterances": [
            "How about a {genres|GENRE}",
            "Let's try a {genres|GENRE}",
            "I want a {genres|GENRE}"
        ]
    },
    function (request, response) {
        console.log ("[GenreIntent]");
        filter_genre (response, request.slot('GENRE'));
    }
);

app.intent('HelpIntent', 
    {
        "slots": {},
        "utterances": [
            "help"
        ]
    },
    function (request, response) {
	    response.say(phr.say("help"));
        var moviename = get_random_movie_name ();
        response.say(phr.say("example", [moviename]))
        response.shouldEndSession (false);
        response.send ();
    }
);


function numberToText(num) {
    var map = [
        "zero",
        "one",
        "two",
        "three",
        "four",
        "five",
        "six",
        "seven",
        "eight",
        "nine",
        "ten",
        "eleven",
        "twelve",
        "thirteen",
        "fourteen",
        "fifteen",
        "sixteen",
        "seventeen",
        "eighteen",
        "nineteen",
        "twenty"
    ];
    if ((num > 0) && (num < map.length)) {
        return map[num];
    }
    else
    {
        return "too big";
    }

}

function filter_movie(response, title){
    var filterlist = retrieveWatchingRecs(response);
    var winninglist = [];
    var genres = [];

    if(!title){
        response.say (phr.say("misheard", ["title"]));
        response.shouldEndSession (false);
        response.send ();
    }

    // work on the filterlist
    for(p in knowledge.plays){
        if (knowledge.plays[p].title.toLowerCase() == title.toLowerCase()){
            genres = knowledge.plays[p].likes;
        }
    }
    winninglist = narrowByAttributes(genres, filterlist);

    if(winninglist.length > 0){
        tryrecommending(winninglist, response);
    }
    else
    {
        saveFilterList(filterlist, response);
        response.say (phr.say("mismatch", [title]));
        response.shouldEndSession (false);
        response.send ();
    }
}

function filter_genre(response, genre){
    var filterlist = retrieveWatchingRecs(response);
    var winninglist = [];
    var genres = [];

    if(!genre){
        response.say (phr.say("misheard", ["genre"]));
        response.shouldEndSession (false);
        response.send ();
    }

    genres.push({"name":genre});

    winninglist = narrowByAttributes(genres, filterlist);

    if(winninglist.length > 0){
        tryrecommending(winninglist, response);
    }
    else
    {
        saveFilterList(filterlist, response);
        response.say (phr.say("mismatch", ["a " + genre]));
        response.shouldEndSession (false);
        response.send ();
    }
}

function narrowByAttributes(attributes, shows){ 
// attributes == all attributes about a show or movie (As array). Shows is an array of shows
// note that for shows, genres is a flat array; for attributes it is an array of objects
  console.log("filtering by " + JSON.stringify(attributes));
  var filtered = [];
  for (var i = 0; i < shows.length; i++) {
    shows[i].numberOfMatchingAttributes = 0;
    for (var j = 0; j < shows[i].genres.length; j++) {
      for(var k = 0; k < attributes.length; k++){
        if(shows[i].genres[j].toLowerCase() == attributes[k].name.toLowerCase()) {
          shows[i].numberOfMatchingAttributes++;
        }
      }
    }
    if(shows[i].numberOfMatchingAttributes > 0) filtered.push(shows[i]);
  }
  return filtered;
}

function retrieveWatchingRecs(response){
    console.log("Retrieving recommendations");
    if(response.session('candidates')){
        //we've already done some work, so use candidates as our basis
        filterlist = JSON.parse(response.session('candidates'));
        return filterlist;
    }
    else
    {
        console.log("Need to open the file");
        filterlist = JSON.parse(fs.readFileSync('watching-04072016-fixed.json','utf-8'));
        return filterlist.recommendations;
    }
}

function saveFilterList(list, response){
    console.log("Saving current list");
    response.session('candidates', JSON.stringify(list));
}

function tryrecommending(filterlist, response) {
    if(filterlist.length < 4){
        //pick a recommendation and give it
        idx = get_random_int (0, filterlist.length - 1);
        response.say (phr.say("suggestion", [filterlist[idx].title]));
        response.say (filterlist[idx].description);
        response.shouldEndSession (true);
        response.send ();
    }
    else
    {
        saveFilterList(filterlist, response);
        //prompt for more information
        response.say (phr.say("progress", [numberToText(filterlist.length)]));
        response.say (phr.say("another thing"));
        response.shouldEndSession (false);
    }
}

function get_random_int(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function get_random_movie_name ()
{
    var num_movies = knowledge.plays.length;
    var idx = get_random_int (0, num_movies - 1);
    return knowledge.plays[idx].title;
}


//console.log ("connecting to lambda...");

// Connect to lambda
exports.handler = app.lambda();

// if you run the function from the command line with "schema" as an argument,
// it will generate the utterances + entities Amazon needs to understand language
// (You should redirect stdout to a file for this!)

if ((process.argv.length === 3) && (process.argv[2] === 'schema'))
{
    console.log (app.schema ());
    console.log (app.utterances ());
}

