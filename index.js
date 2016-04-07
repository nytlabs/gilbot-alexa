var alexa = require('alexa-app');
var Levenshtein = require('levenshtein');
var omdb = require('omdb');
var fs = require('fs');

var app = new alexa.app();
var knowledge = JSON.parse(fs.readFileSync('knowledge.json', 'utf8'));

app.launch(function(request,response) {
    response.session ('open_session', 'true');
	response.say("Gilbot is ready. For help, say help.  To leave, say exit.");
    //select a random "tool" to start
	response.shouldEndSession (false, "What would you like to know?  For examples, say help.  To leave, say exit.");
});

var names = []
for (p in knowledge.plays) {
    names.push(knowledge.plays[p].title);
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
        response.say("How about we start with what you like. Give me an example of a show or movie you really enjoyed.");
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
            "What {show|movie|film|program} is {similar |most like |comparable to |like }{movie_names|TITLE}",
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
	    response.say("Gilbot uses movies and television shows you like to recommend others to watch. Start by saying something like ");

        var alt = get_random_int (0, 5);
        var moviename = get_random_movie_name ();

        switch (alt)
        {
            case 0:
	            response.say("I really liked " + moviename);
                break;
            case 1:
	            response.say("What T V show is most like " + moviename);
                break;
            case 2:
	            response.say("I liked " + moviename);
                break;
            case 3:
	            response.say("I loved " + moviename);
                break;
            case 4:
	            response.say("What film is similar to " + moviename);
                break;
            case 5:
	            response.say("What's something that's like  " + moviename);
                break;
        }

        response.shouldEndSession (false);

        response.send ();
    }
);

function filter_movie(response, title){
    var filterlist = retrieveWatchingRecs(response);
    var winninglist = [];
    var genres = [];

    // work on the filterlist
    for(p in knowledge.plays){
        if (knowledge.plays[p].title.toLowerCase() == title.toLowerCase()){
            genres = knowledge.plays[p].likes;
        }
    }
    winninglist = narrowByAttributes(genres, filterlist);

    if(winninglist.length > 0){
        tryrecommending(winninglist);
    }
    else
    {
        saveFilterList(filterlist, response);
        response.say ("Sorry, but I don't have anything right now that's like " + title + ". What else do you like?")
        response.shouldEndSession (false);
        response.send ();
    }
}

function filter_genre(response, genre){
    var filterlist = retrieveWatchingRecs(response);
    var winninglist = [];
    var genres = [];
    genres.push({"name":genre});

    winninglist = narrowByAttributes(genres, filterlist);

    if(winninglist.length > 0){
        tryrecommending(winninglist);
    }
    else
    {
        saveFilterList(filterlist, response);
        response.say ("Sorry, but I don't have anything right now in " + genre + ". What else do you like?")
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
    //response.session('candidates', JSON.stringify(list));
}

function tryrecommending(filterlist) {
    if(filterlist.length < 4){
        //pick a recommendation and give it
        idx = get_random_int (0, num_movies - 1);
        response.say ("I would recommend " + filterlist[idx].title + ". " + filterlist[idx].description);
        response.shouldEndSession (true);
        response.send ();
    }
    else
    {
        saveFilterList(filterlist);
        //prompt for more information
        response.say ("Great; we're getting closer. Can you tell me another show, movie, or genre you like?");
        if (response.session ('open_session') === 'true')
        {
            response.shouldEndSession (false);
        }
        response.send (); 
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


console.log ("connecting to lambda...");

// Connect to lambda
exports.handler = app.lambda();

if ((process.argv.length === 3) && (process.argv[2] === 'schema'))
{
    console.log (app.schema ());
    console.log (app.utterances ());
}

