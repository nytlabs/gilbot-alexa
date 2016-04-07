var Levenshtein = require('levenshtein');
var omdb = require('omdb');
var SampleMovies = require('SampleMovies');
var WordsToNumber = require ('WordsToNumber');
var fs = require('fs');
 
// lookup_movie (response, process_title (request.slot('TITLE')), 'plot')


function get_random_int(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function get_random_movie_name ()
{
    var num_movies = SampleMovies.titles.length;
    var idx = get_random_int (0, num_movies - 1);
    return SampleMovies.titles[idx];
}

function process_title (movie_title)
{
    var AmbiguousMovies = require('AmbiguousMovies');

    //console.log ("  title before: " + movie_title);

    if (typeof AmbiguousMovies.titles[movie_title] !== 'undefined')
    {
        movie_title = AmbiguousMovies.titles[movie_title];
        console.log ("  title after: " + movie_title);
        return movie_title;
    }

    movie_title = movie_title.replace (/\sversus\s/, " vs ");

    movie_title = WordsToNumber (movie_title, true);

    //console.log ("  title after: " + movie_title);

    return movie_title;
}


function lookup_movie (movie_title, desired_info, callback)
{
    var search_terms = {
        terms: movie_title
    };

    //console.log ("looking for movie " + movie_title);

    omdb.search(search_terms , function(err, movies) {
        if(err) {
            console.log("error accessing OMDB");
            console.error(err);
            return;
        }

        if(movies.length < 1) {
            console.log ("no movies returned");
            return;
        }

        var m = find_closest_match (movies, movie_title);

        //console.log ("getting details for imdb id " + m.imdb);

        omdb.get ({ imdb: m.imdb }, function (err, movie) {
            if(err) {
                console.log("error getting details on "+m.imdb);
                console.error(err);
                return;
            }

            if(!movie) {
                console.log ("no movie returned");
                return;
            }

            var response_text = movie.title + ", released " + movie.year;

            var tags = [];
            //tags.push({"year":movie.year});

            if (movie.actors.length > 1)
            {
                response_text += ", starring " + movie.actors[0] + " and " + movie.actors[1];
                tags.push({"name":movie.actors[0],"count":1,"type":"actor"});
                tags.push({"name":movie.actors[1],"count":1,"type":"actor"});
            }
            else if (movie.actors.length == 1)
            {
                response_text += ", starring " + movie.actors[0];
                tags.push({"name":movie.actors[0],"count":1,"type":"actor"});
            }

            switch (desired_info)
            {
                case 'ratings':
                    if (movie.imdb.rating === null)
                    {
                        response_text += ", does not have an IMDB rating";
                    }
                    else
                    {
                        response_text += ", has an IMDB rating of " + movie.imdb.rating + " out of ten";
                        card_text += "; IMDB rating: " + movie.imdb.rating + " / 10";
                    }

                    if (movie.metacritic !== null)
                    {
                        response_text += ". It has a meta critic rating of " + movie.metacritic + " out of one hundred";
                        card_text += "; Metacritic rating: " + movie.metacritic + " / 100";
                    }

                    var matches;
                    if ((matches = movie.awards.match (/Won\s+(\d+)\s+Oscar/)) !== null)
                    {
                        var num_matches = parseInt (matches[1]);
                        if (num_matches > 1)
                        {
                            response_text += ".  It won " + num_matches + " Oscars";
                            card_text += "; won " + num_matches + " Oscars";
                        }
                        else if (num_matches == 1)
                        {
                            response_text += ".  It won an Oscar";
                            card_text += "; won an Oscar";
                        }
                    }

                    response_text += ".";
                    break;

                case 'plot':
                    if (!movie.plot)
                    {
                        response_text += ", no plot summary available.";
                        card_text += "; no plot summary available.";
                    }
                    else
                    {
                        response_text += ", plot summary: " + movie.plot;
                        card_text += "; Plot summary: " + movie.plot;
                    }
                    break;

                case 'genres':
                    if (!movie.genres)
                    {
                        response_text += ", no genres available.";
                    }
                    else
                    {
                        response_text += ", genres: " + movie.genres;
                        for (g in movie.genres){
                            tags.push({"name":movie.genres[g],"count":1,"type":"genre"})
                        }
                    }
                    break;
            }

            console.log ("response_text: " + response_text);
            if(callback) {
                callback(movie_title, tags);
            }
        });
    });
}

function find_closest_match (movies, movie_title)
{
    // we will penalize older movies so that if there are two movies with the
    // exact same name, we'll be biased toward the more recent one
    var this_year = new Date().getFullYear();

    var min_distance = 999999999;
    var best_match = null;
    for (var i = 0; i < movies.length; i++)
    {
        var m = movies[i];

        var t = m.title;

        var l = new Levenshtein (movie_title, t);

        var d = l.distance; // + (this_year - m.year) / 1000;
        //console.log ("[find_closest_match] " + t + " (" + m.year + "): " + d);
        if (d < min_distance)
        {
            min_distance = d;
            best_match = m;
        }
    }

    return best_match;
}

var waiting = 0;
function trytofinish(data){
    if(!waiting) {
        console.log("beep");
        fs.writeFile("output.json", JSON.stringify(data), function(err) {
            if(err){
                return console.log(err);
            }
            console.log("Saved updated file to output.json");
        });
    }
}

if ((process.argv.length === 3))
{
    var waiting = 0;
    fs.readFile(process.argv[2], function(err,data){
        if(err){
            console.log("Couldn't open "+process.argv[2]+". Attempting to look it up as a word.")
            lookup_movie (process_title (process.argv[2]), 'genres');
        }
        else
        {   
            var datafile = JSON.parse(data);

            for (i in datafile.plays) {
                waiting ++;
                setTimeout(lookup_movie(datafile.plays[i].title, "genres", function(title, resultset){
                    for (x in datafile.plays) {
                        if(datafile.plays[x].title == title){
                            var temp = datafile.plays[x].likes.concat(resultset);
                            datafile.plays[x].likes = temp;
                        }
                    }
                    waiting --;
                    console.log("waiting = " + waiting);
                    trytofinish(datafile);
                }), 3000);
            }
        }
    })
}
