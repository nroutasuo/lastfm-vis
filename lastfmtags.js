/**
* Tag Cloud and Tag Timeline visualizations
* Last.fm tools by Noora Routasuo
* Built with D3.js (https://d3js.org/)
* Last.fm (https://www.last.fm/api)
*/

var apiKey = '7368f1aa0cd2d8defcba395eb5e9fd63';

var tags = {};
var tagsByArtist = {};
var filteredTags = [];

function makeCloud(username, count, period) {
    filteredTags = [];
    var onArtistsDone = function (data) {
        fetchTags(data);
    }
    fetchTopArtists(username, count, period, onArtistsDone);
}

function makeTimeline(username, count) {
    filteredTags = [];
    var onChartsDone = function (data) {
        fetchWeeklyArtistCharts(username, data.weeklychartlist, count);
    }
    fetchWeeklyCharts(username, onChartsDone);
}

function fetchTopArtists(username, count, period, callback) {
    console.log("Fetching " + count + " top artists for " + username + "...");
    $.ajax({ 
        type: 'POST',
        url: 'https://ws.audioscrobbler.com/2.0/',
        data: 'method=user.gettopartists&' +
               'user=' + username + '&' +
               'limit=' + count + '&' +
               'period' + period + '&' +
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

function fetchWeeklyArtistCharts(username, charts, count) {
    count = Math.min(count, 20);
    // TODO choose time bins depending on how much data the user has - years or months
    var chartsToGet = Math.min(charts.chart.length, 52*15);
    var chartsDone = 0;
    var artistsByYear = {};
    var onWeekDone = function (data) {
        chartsDone++;
        showLoaded(chartsDone / chartsToGet * 100);
        var year = new Date(data.weeklyartistchart['@attr'].from * 1000).getFullYear();
        if (!artistsByYear[year])
            artistsByYear[year] = [];
        var maxArtists = Math.min(data.weeklyartistchart.artist.length, count);
        for (var j = 0; j < maxArtists; j++) {
            var artist = data.weeklyartistchart.artist[j];
            if (artist.playcount < 2)
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

function fetchTags(artists) {
    tags = {};
    var totalartists = artists.topartists.artist.length;
    var artistsready = 0;
    
    showLoaded(0);
    
    var onArtistOK = function (data) {
        tags[data.toptags['@attr'].artist] = data;
    };
    
    var onArtistReady = function () {
        artistsready++;
        showLoaded(artistsready / totalartists * 100);
        if (artistsready == totalartists) {
            buildCloudVis();
        }        
    };
    
    var artist;
    for (var i = 0; i < artists.topartists.artist.length; i++) {
        artist = artists.topartists.artist[i];
        fetchTagsForArtist(artist, onArtistOK, onArtistReady);
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
    
    var onArtistOK = function (data) {
        tags[year][data.toptags['@attr'].artist] = data;
    };
    
    var onArtistReady = function () {
        artistsready++;
        showLoaded(artistsready / totalartists * 100);
        if (artistsready == totalartists) {
            if (yearIndex < keys.length - 1) {
                fetchTagsForYear(keys[yearIndex + 1], artistsByYear);
            } else {
                buildTimelineVis();
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
    if (tagsByArtist[artist.mbid]) {
        okCallback(tagsByArtist[artist.mbid]);
        responseCallback();
        return;
    }
    
    $.ajax({
        type: 'POST',
        url: 'https://ws.audioscrobbler.com/2.0/',
        data: 'method=artist.gettoptags&' +
               'mbid=' + artist.mbid + '&' +
               'api_key=' + apiKey + '&' +
               'format=json',
        dataType: 'jsonp',
        success: function(data) {
            if (data.toptags) {
                tagsByArtist[artist.mbid] = data;
                okCallback(data);
            }
            responseCallback();
        },
        error: function(code, message){
            console.log("Failed to fetch tags for " + artist.name + ".");
            showError("Failed to fetch tags for " + artist.name + ".");
            responseCallback();
        }
    });
}

function buildCloudVis() {
    console.log("Building vis...")
    var counts = getTagCounts(tags);
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

function buildTimelineVis() {
    console.log("Building timeline..");
    
    // Set the dimensions of the canvas / graph
    // TODO limit width by number of data points on x, max ~300 px per point
    var	margin = {top: 10, right: 120, bottom: 30, left: 10},
        width = getMaxVisWidth() - margin.left - margin.right,
        height = getMaxVisHeight() - margin.top - margin.bottom;
    
    // Adds the svg canvas
    var	svg = d3.select("#sec_vis")
        .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
        .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    
    // Set up data
    var years = Object.keys(tags);
    var data = GetTimelineData();
    var	parseDate = d3.time.format("%Y-%m").parse;
	data.forEach(function(d) {
		d.date = parseDate(d.date);
	});
     
    // Set the ranges
    var	x = d3.time.scale().range([0, width]);
	x.domain(d3.extent(data, function(d) { return d.date; }));
    var	y = d3.scale.linear().domain([0, 100]).range([height, 0]);
     
    // Define the axes
    var	xAxis = d3.svg.axis().scale(x)
        .orient("bottom").ticks(years.length);
    var	yAxis = d3.svg.axis().scale(y)
        .orient("right").ticks(5);
     
    // Define the line
    var currenttag = null;
    var	tagline = d3.svg.line()
        .x(function(d) { return x(d.date); })
        .y(function(d) { return (!d.tagsscaled[currenttag]) ? y(0) : y(d.tagsscaled[currenttag]); });
    
    // Define mouseovers
    var onPathMouseOver = function (d) {
        d3.select(this).classed("highlighted", true);
        d3.select(this.parentNode).select(".tagname").classed("highlighted", true);
    };
    var onPathMouseOut = function (d) {
        d3.select(this).classed("highlighted", false);
        d3.select(this.parentNode).select(".tagname").classed("highlighted", false);
    };
    var onLabelMouseOver = function (d) {
        d3.select(this).classed("highlighted", true);
        d3.select(this.parentNode).select(".tagline").classed("highlighted", true);
    };
    var onLabelMouseOut = function (d) {
        d3.select(this).classed("highlighted", false);
        d3.select(this.parentNode).select(".tagline").classed("highlighted", false);
    };
 
	// Add the tags
    var lastyear = years[years.length -1];
    var counts = getTagCounts(tags[lastyear]);
    var tagcounts = counts.counts;
    var tagcounttotal = counts.total;
    var sortedNames = getSortedTagNames(tagcounts);
    for (var i = Math.min(sortedNames.length, 50) - 1; i >= 0; i--) {
        currenttag = sortedNames[i];
        var count = tagcounts[currenttag];
        var yval = data[data.length-1].tagsscaled[currenttag];
        if (!yval)
            yval = 0;
        var g = svg.append("g");
        g.append("path")	
            .attr("class", "tagline")
            .attr("d", tagline(data))
            .on("mouseover", onPathMouseOver)
            .on("mouseout", onPathMouseOut);
        g.append("text")
            .attr("class", "tagname")
            .attr("transform", "translate(" + width + "," + y(yval) + ")")
            .attr("x", 3)
            .attr("dy", "0.35em")
            .style("font", "11px sans-serif")
            .text(currenttag)
            .on("mouseover", onLabelMouseOver)
            .on("mouseout", onLabelMouseOut);
    }
 
	// Add the axes
	svg.append("g")
		.attr("class", "x axis")
		.attr("transform", "translate(0," + height + ")")
		.call(xAxis);
 
    // TODO show/explain what the y axis means
    /*
	svg.append("g")		
		.attr("class", "y axis")
        .attr("transform", "translate(" + width + ",0)")
		.call(yAxis);
    */
}

function getMaxVisWidth() {
    var width = $("#sec_vis").width();
    if (!width) 
        width = 600;
    else
        width -= 80;
    return width;
}

function getMaxVisHeight() {
    var height = $(window).height();
    if (!height)
        height = 400;
    else
        height -= 80;
    
    if (height > 1000)
        height = 1000;
    if (height < 200)
        height = 200;
    return height;
}

function GetTimelineData() {
    var data = [];
    var years = Object.keys(tags);
    var year;
    for (var i = 0; i < years.length; i++) {
        year = years[i];
        var d = {};
        d.year = year;
        d.date = year + "-1";
        var counts = getTagCounts(tags[year]);
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
    console.log(data);
    return data;
}

function getTagCounts(tags) {
    var tagcounts = {};
    var tagcounttotal = 0;
    
    var tag;
    var tagname;
    for (var key in tags) {
        for (var i = 0; i < tags[key].toptags.tag.length; i++) {
            tag = tags[key].toptags.tag[i];
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
    if (name === "seen live")
        return false;
    if (name === "favourites")
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

// TODO extend to user-specified filter
var countrytags = [ 
    "finnish", "swedish", "japanese", "american", "scandinavian", "suomi", "france", "brazilian", "irish", "german", "uk", "brasil", "usa", "french", "australian", "italian", "norwegian", "norway", "sweden", "british" 
];
