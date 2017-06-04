/**
* Tag Cloud and Tag Timeline visualizations
* Last.fm tools by Noora Routasuo
* Built with D3.js (https://d3js.org/)
* Last.fm (https://www.last.fm/api)
*/

var apiKey = '7368f1aa0cd2d8defcba395eb5e9fd63';

// constants
var maxPeriodArtistCount = 500;
var maxWeeklyArtistCount = 25;
var maxWeeklyChartsToFetch = 52 * 15;
var minWeeklyArtistPlayCount = 2;

// keep between visualizations
var tagsByArtist = {};

// reset depending on selections
var tags = {};
var filteredTags = [];

function makeCloud(username, count, period) {
    filteredTags = [];
    var onArtistsDone = function (data) {
        fetchTagsForCloud(data);
    }
    fetchTopArtists(username, count, period, onArtistsDone);
}

function makeTimeline(username) {
    filteredTags = [];
    var onChartsDone = function (data) {
        fetchWeeklyArtistCharts(username, data.weeklychartlist);
    }
    fetchWeeklyCharts(username, onChartsDone);
}

function fetchTopArtists(username, count, period, callback) {
    count = Math.min(count, maxPeriodArtistCount);
    console.log("Fetching " + count + " top " + period + " artists for " + username + "...");
    $.ajax({ 
        type: 'POST',
        url: 'https://ws.audioscrobbler.com/2.0/',
        data: 'method=user.gettopartists&' +
               'user=' + username + '&' +
               'limit=' + count + '&' +
               'period=' + period + '&' +
               'api_key=' + apiKey + '&' +
               'format=json',
        dataType: 'jsonp',
        success: function(data) {
            console.log("Top artists fetched!");
            callback(data);
        },
        error: function(code, message){
            console.log("Failed to fetch top artists.");
            showError("Failed to fetch top artists");
        }}
    );
}

function fetchWeeklyCharts (username, callback) {
    console.log("Fetching charts for " + username + "...");
    $.ajax({ 
        type: 'POST',
        url: 'https://ws.audioscrobbler.com/2.0/',
        data: 'method=user.getweeklychartlist&' +
               'user=' + username + '&' +
               'api_key=' + apiKey + '&' +
               'format=json',
        dataType: 'jsonp',
        success: function(data) {
            console.log("Charts fetched!");
            callback(data);
        },
        error: function(code, message){
            console.log("Failed to fetch charts.");
            showError("Failed to fetch charts");
        }}
    );
}

function fetchWeeklyArtistCharts(username, charts) {
    // TODO choose time bins depending on how much data the user has - years or months
    var chartsToGet = Math.min(charts.chart.length, maxWeeklyChartsToFetch);
    var chartsDone = 0;
    var artistsByYear = {};
    var onWeekDone = function (data) {
        chartsDone++;
        showLoaded(chartsDone / chartsToGet * 50);
        var year = new Date(data.weeklyartistchart['@attr'].from * 1000).getFullYear();
        if (!artistsByYear[year])
            artistsByYear[year] = [];
        var maxArtists = Math.min(data.weeklyartistchart.artist.length, maxWeeklyArtistCount);
        for (var j = 0; j < maxArtists; j++) {
            var artist = data.weeklyartistchart.artist[j];
            if (artist.playcount < minWeeklyArtistPlayCount)
                continue;
            if (artistsByYear[year].indexOf(artist) < 0) {
                artistsByYear[year].push(artist);
            }
        }
        if (chartsDone == chartsToGet) {
            fetchTagsByYear(artistsByYear);
        }
    };
    for (var i = 0; i < chartsToGet; i++) {
        var chart = charts.chart[charts.chart.length - i - 1];
        fetchWeeklyArtistChart(username, chart.from, chart.to, onWeekDone);
    }
}

function fetchWeeklyArtistChart(username, fromTimestamp, toTimestamp, callback) {
    $.ajax({
        type: 'POST',
        url: 'https://ws.audioscrobbler.com/2.0/',
        data: 'method=user.getweeklyartistchart&' +
               'user=' + username + '&' +
               'from=' + fromTimestamp + '&' +
               'to=' + toTimestamp + '&' +
               'api_key=' + apiKey + '&' +
               'format=json',
        dataType: 'jsonp',
        success: function(data) {
            if (!data.weeklyartistchart) {
                showError("Failed to fetch charts.");
                return;
            }
            callback(data);
        },
        error: function(code, message){
            console.log("Failed to fetch charts.");
            showError("Failed to fetch charts");
        }}
    );
}

function fetchTagsForCloud(artists) {
    var totalartists = artists.topartists.artist.length;
    var artistsready = 0;
    
    var onArtistReady = function (artist, data) {
        artistsready++;
        showLoaded(artistsready / totalartists * 100);
        if (artistsready == totalartists) {
            buildCloudVis(artists);
        }        
    };
    
    var artist;
    for (var i = 0; i < totalartists; i++) {
        artist = artists.topartists.artist[i];
        fetchTagsForArtist(artist, null, onArtistReady);
    }
}

function fetchTagsByYear(artistsByYear) {
    tags = {};
    fetchTagsForYear(Object.keys(artistsByYear)[0], artistsByYear);
}

function fetchTagsForYear(year, artistsByYear) {
    console.log("Fetching tags for " + artistsByYear[year].length + " artists for the year " + year);
    
    var keys = Object.keys(artistsByYear);
    var yearIndex = keys.indexOf(year);

    var totalartists = artistsByYear[year].length;
    var artistsready = 0;
    
    tags[year] = {};
    
    var onArtistOK = function (artist, data) {
        tags[year][getArtistID(artist)] = data;
    };
    
    var onArtistReady = function (artist) {
        artistsready++;
        var yearPercentage = yearIndex / keys.length;
        yearPercentage += artistsready / totalartists / keys.length;
        showLoaded(50 + yearPercentage * 50);
        if (artistsready == totalartists) {
            if (yearIndex > 0) 
                buildTimelineVis(artistsByYear);
                
            if (yearIndex < keys.length - 1) {
                fetchTagsForYear(keys[yearIndex + 1], artistsByYear);
            } else {
                stopLoading("Done.", "");
            }
        }
    };

    var artist;
    for (var i = 0; i < artistsByYear[year].length; i++) {
        artist = artistsByYear[year][i];
        fetchTagsForArtist(artist, onArtistOK, onArtistReady);
    }
    
    if (artistsByYear[year].length === 0) {
        delete tags[year];
        totalartists = 1;
        onArtistReady();
    }
}

function fetchTagsForArtist(artist, okCallback, responseCallback) {
    if (!working)
        return;
    if (tagsByArtist[getArtistID(artist)]) {
        if (okCallback)
            okCallback(artist, tagsByArtist[getArtistID(artist)]);
        responseCallback(artist);
        return;
    }
    
    var showCallError = function () {
        console.log("Failed to fetch tags for " + artist.name + ".");
        showError("Failed to fetch tags for " + artist.name + ".");
    }
    
    $.ajax({
        type: 'POST',
        url: 'https://ws.audioscrobbler.com/2.0/',
        data: 'method=artist.gettoptags&' +
           'artist=' + artist.name + '&' + 
           'mbid=' + artist.mbid + '&' +
           'api_key=' + apiKey + '&' +
           'format=json',
        dataType: 'jsonp',
        success: function(data) {
            if (data.toptags) {
                tagsByArtist[getArtistID(artist)] = data;
                if (okCallback)
                    okCallback(artist, data);
            } else {
                showCallError();
            }
            responseCallback(artist);
        },
        error: function(code, message){
            showCallError();
            responseCallback(artist);
        }
    });
}

function buildCloudVis(artists) {
    console.log("Building vis...")
    var counts = getTagCounts(tagsByArtist, artists.topartists.artist);
    var tagcounts = counts.counts;
    var tagcounttotal = counts.total;
    var sortedNames = getSortedTagNames(tagcounts);
    
    clearVis();
    
    $("#sec_vis").append("<ul>");
    var max = Math.min(sortedNames.length, 50);
    for (var i = 0; i < max; i++) {
        var tagname = sortedNames[i];
        var count = tagcounts[tagname];
        var tagsize = Math.round(count / tagcounttotal * 500);
        tagsize = Math.max(Math.min(10, tagsize), 1);
        var tagclass = "tag-size-" + tagsize;
        var li = $("<li class='tag " + tagclass + "'>" + tagname + "</li>");
        $("#sec_vis ul").append(li);
    }
    console.log("Showing tags: " + max + "/" + sortedNames.length);
    stopLoading("Done.", "");
}

function buildTimelineVis(artistsByYear) {
    console.log("Building timeline..");
    clearVis();
    
    // Set the dimensions of the canvas / graph
    // TODO limit width by number of data points on x, max ~300 px per point
    var	margin = {top: 10, right: 150, bottom: 30, left: 25},
        width = getMaxVisWidth() - margin.left - margin.right,
        height = getMaxVisHeight() - margin.top - margin.bottom;
    
    // Add the svg canvas
    var	svg = d3.select("#sec_vis")
        .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
        .append("g")
            .attr("class", "visarea")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    
    // Set up data
    var years = Object.keys(tags);
    var data = GetTimelineData(artistsByYear);
    var	parseDate = d3.time.format("%Y-%m").parse;
	data.forEach(function(d) {
		d.date = parseDate(d.date);
	});
     
    // Set the ranges
    var	x = d3.time.scale().range([0, width]);
	x.domain(d3.extent(data, function(d) { return d.date; }));
    var	y = d3.scale.linear().domain([0, 100]).range([height, 0]);
     
    // Define the line
    var currenttag = null;
    var	tagline = d3.svg.line()
        .interpolate("cardinal")
        .tension(0.8)
        .x(function(d) { return x(d.date); })
        .y(function(d) { return (!d.tagsscaled[currenttag]) ? y(0) : y(d.tagsscaled[currenttag]); });
    
    // Define mouseovers
    var tooltip = d3.select("#sec_vis").append("div")	
        .attr("class", "tooltip")				
        .style("opacity", 0);
    
    var onPathMouseOver = function (d) {
        d3.select("svg").classed("highlighted", true);
        d3.select(this).classed("highlighted", true);
        d3.select(this.parentNode).select(".tagname").classed("highlighted", true);
        tooltip.transition()		
            .duration(200)		
            .style("opacity", .9);
        var visoffset = $(".visarea").offset();
        var relX = d3.event.pageX - visoffset.left;
        var relY = d3.event.pageY - visoffset.top;
        var year = x.invert(relX).getFullYear();
        var value = Math.max(0, Math.min(100, Math.round(y.invert(relY)))) + "%";
        tooltip.html(d3.select(this).attr("tag") + "<br/>" + year + "<br/>" + value)
            .style("left", (d3.event.pageX - 50) + "px")		
            .style("top", (d3.event.pageY + 10) + "px");
    };
    var onPathMouseOut = function (d) {
        d3.select("svg").classed("highlighted", false);
        d3.selectAll(".highlightable").classed("shadowed", false);
        d3.select(this).classed("highlighted", false);
        d3.select(this.parentNode).select(".tagname").classed("highlighted", false);
        tooltip.transition()		
            .duration(300)		
            .style("opacity", 0);	
    };
    var onLabelMouseOver = function (d) {
        d3.select("svg").classed("highlighted", true);
        d3.select(this).classed("highlighted", true);
        d3.select(this.parentNode).select(".tagline").classed("highlighted", true);
    };
    var onLabelMouseOut = function (d) {
        d3.select("svg").classed("highlighted", false);
        d3.select(this).classed("highlighted", false);
        d3.select(this.parentNode).select(".tagline").classed("highlighted", false);
    };
 
	// Add the tags
    var lastyear = years[years.length -1];
    var counts = getTagCounts(tags[lastyear], artistsByYear[lastyear]);
    var tagcounts = counts.counts;
    var tagcounttotal = counts.total;
    var sortedNames = getSortedTagNames(tagcounts);
    
    for (var i = Math.min(sortedNames.length, 100) - 1; i >= 0; i--) {
        currenttag = sortedNames[i];
        var count = tagcounts[currenttag];
        var yval = data[data.length-1].tagsscaled[currenttag];
        if (!yval)
            yval = 0;
        var g = svg.append("g");
        g.append("path")	
            .attr("class", "tagline highlightable")
            .attr("d", tagline(data))
            .attr("tag", currenttag)
            .on("mouseover", onPathMouseOver)
            .on("mouseout", onPathMouseOut);
        g.append("text")
            .attr("class", "tagname highlightable")
            .attr("transform", "translate(" + width + "," + y(yval) + ")")
            .attr("x", 3)
            .attr("dy", "0.35em")
            .style("font", "11px sans-serif")
            .text(currenttag)
            .on("mouseover", onLabelMouseOver)
            .on("mouseout", onLabelMouseOut);
    }
 
	// Add the axes
    var	xAxis = d3.svg.axis().scale(x)
        .orient("bottom").ticks(years.length);
    var	yAxis = d3.svg.axis().scale(y)
        .orient("left").ticks(5);
	svg.append("g")
		.attr("class", "x axis")
		.attr("transform", "translate(0," + height + ")")
		.call(xAxis);
	svg.append("g")		
		.attr("class", "y axis")
        .attr("transform", "translate(0,0)")
		.call(yAxis);
}

function GetTimelineData(artistsByYear) {
    var data = [];
    var years = Object.keys(tags);
    var year;
    for (var i = 0; i < years.length; i++) {
        year = years[i];
        var d = {};
        d.year = year;
        d.date = year + "-1";
        var counts = getTagCounts(tags[year], artistsByYear[year]);
        console.log(year);
        console.log(counts);
        var tagcounts = counts.counts;
        var tagcounttotal = counts.total;
        var sortedNames = getSortedTagNames(tagcounts);
        var tagsmax = Math.min(sortedNames.length, 25);
        d.tags = {};
        d.maxcount = 0;
        for (var j = 0; j < tagsmax; j++) {
            var tagname = sortedNames[j];
            var count = tagcounts[tagname];
            d.tags[tagname] = count;
            if (count > d.maxcount)
                d.maxcount = count;
        }
        d.tagsscaled = {};
        for (var j = 0; j < tagsmax; j++) {
            var tagname = sortedNames[j];
            var count = tagcounts[tagname];
            d.tagsscaled[tagname] = Math.round(parseFloat(count) / d.maxcount * 100);
        }
        data.push(d);
    }
    console.log("timeline data:");
    console.log(data);
    return data;
}

function getTagCounts(tagsByArtist, artists) {
    var tagcounts = {};
    var tagcounttotal = 0;
    
    var artist;
    var tag;
    var tagname;
    for (var i = 0; i < artists.length; i++) {
        artist = getArtistID(artists[i]);
        if (!tagsByArtist[artist])
            continue;
        for (var j = 0; j < tagsByArtist[artist].toptags.tag.length; j++) {
            tag = tagsByArtist[artist].toptags.tag[j];
            tagname = cleanupTagName(tag.name);
            if (!filterTagName(tagname)) {
                recordFilteredTag(tagname);
                continue;
            }
            
            if (!tagcounts[tagname]) {
                tagcounts[tagname] = 0;
            }
            tagcounts[tagname] += parseInt(tag.count);
            tagcounttotal += parseInt(tag.count);
        }
    }
    return { counts: tagcounts, total: tagcounttotal };
}

function getSortedTagNames(tagcounts) {
    var names = Object.keys(tagcounts);
    names.sort(function (a, b) {
        return tagcounts[b] - tagcounts[a];
    });
    return names;
}

function cleanupTagName(name) {
    return name.toLowerCase().replace(/-/g, " ");
}

function recordFilteredTag(name) {
    if (filteredTags.indexOf(name) < 0) {
        filteredTags.push(name);
        showVisDetails("Filtered tags: " + filteredTags.join(", "));
    }
}

function filterTagName(name) {
    if (nondescriptivetags.indexOf(name) >= 0)
        return false;
    if (filterCountries && !filterTagNameCountries(name))
        return false;
    if (filterDecades && !filterTagNameDecades(name))
        return false;
    return true;
}

function filterTagNameCountries(name) {
    if (countrytags.indexOf(name) >= 0)
        return false;
    return true;
}

function filterTagNameDecades(name) {
    var match = name.match(/^(20)?(19)?(\d\d)(s)?$/);
    if (match != null && match.length > 0)
        return false;
    return true;
}

var countrytags = [ 
    "finnish", "swedish", "japanese", "american", "scandinavian", "suomi", "france", "brazilian", "brazil", "irish", "german", "uk", "brasil", "usa", "french", "australian", "italian", "norwegian", "norway", "sweden", "british", "africa", "afrika", "arabic", "asian", "polish", "russian", "canadian", "latin", "deutsch", "spanish", "korean", "english", "dutch", "icelandic"
];

var nondescriptivetags = [
    "seen live", "favourites", "favourite", "favourite songs", "good", "awesome", "love", "loved", "beautiful", "albums i own", "under 2000 listeners", "sexy", "live", "heard on pandora", "love at first listen", "spotify"
]
