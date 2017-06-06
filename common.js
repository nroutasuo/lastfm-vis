
// LAST.FM STUFF

var apiKey = '3ef6e7e91fadb29f8653958588f47c23';

// keep between visualizations
var chartsByUser = {};
var artistChartsByUser = {};

// constants
var maxWeeklyChartsToFetch = 52 * 15;
var minWeeklyArtistPlayCount = 1;

function fetchWeeklyCharts(user, callback) {
    console.log("Fetching weekly charts for " + user + "...");
    if (chartsByUser[user])
        callback(chartsByUser[user]);
    
    $.ajax({ 
        type: 'POST',
        url: 'https://ws.audioscrobbler.com/2.0/',
        data: 'method=user.getweeklychartlist&' +
               'user=' + user + '&' +
               'api_key=' + apiKey + '&' +
               'format=json',
        dataType: 'jsonp',
        success: function(data) {
            if (data.weeklychartlist) {
                console.log("Weekly charts for " + user + " fetched! (" + data.weeklychartlist.chart.length + ")");
                chartsByUser[user] = data;
                callback(data);
            } else {
                working = false;
                showError("Failed to fetch charts for " + user + ".");                
            }
        },
        error: function(code, message){
            working = false;
            showError("Failed to fetch charts for " + user + ". " + message);
        }}
    );
}

function fetchWeeklyArtistCharts(username, charts, doneCallback, loadingProcessFactor, maxWeeklyArtists) {
    if (!working)
        return;
    
    console.log("Fetching weekly artists charts for " + username);
    
    // TODO choose time bins depending on how much data the user has - years or months
    var chartsToGet = Math.min(charts.chart.length, maxWeeklyChartsToFetch);
    var chartsDone = 0;
    var artistsByYear = {};
    var artistsByID = {};
    
    var onWeekDone = function (data) {
        if (!working)
            return;
        
        chartsDone++;
        showLoaded(chartsDone / chartsToGet * loadingProcessFactor);
        
        var year = new Date(data.weeklyartistchart['@attr'].from * 1000).getFullYear();
        if (!artistsByYear[year])
            artistsByYear[year] = [];
        if (!artistsByID[year])
            artistsByID[year] = {};
        
        var maxArtists = Math.min(data.weeklyartistchart.artist.length, maxWeeklyArtists);
        for (var j = 0; j < maxArtists; j++) {
            var artist = data.weeklyartistchart.artist[j];
            if (artist.playcount < minWeeklyArtistPlayCount)
                continue;
            
            var artistID = getArtistID(artist);
            var existingartist = artistsByID[year][artistID];
            if (!existingartist) {
                artistsByID[year][artistID] = artist;
                artistsByYear[year].push(artist);
                artist.totalplaycount = parseInt(artist.playcount);
            } else {
                existingartist.totalplaycount += parseInt(artist.playcount);
            }
        }
        
        if (chartsDone == chartsToGet) {
            for (var y in artistsByYear) {
                artistsByYear[y].sort(function(a, b) {
                    return b.totalplaycount - a.totalplaycount;
                });
            }
            doneCallback(artistsByYear);
        }
    };
    for (var i = 0; i < chartsToGet; i++) {
        var chart = charts.chart[charts.chart.length - i - 1];
        fetchWeeklyArtistChart(username, chart.from, chart.to, onWeekDone);
    }
}

function fetchWeeklyArtistChart(name, fromTimestamp, toTimestamp, callback) {
    if (!working || name != username)
        return;
    
    if (!artistChartsByUser[name])
        artistChartsByUser[name] = {};

    var cachekey = fromTimestamp + "-" + toTimestamp;
    if (artistChartsByUser[name][cachekey]) {
        callback(artistChartsByUser[name][cachekey]);
        return;
    }
    
    $.ajax({
        type: 'POST',
        url: 'https://ws.audioscrobbler.com/2.0/',
        data: 'method=user.getweeklyartistchart&' +
               'user=' + name + '&' +
               'from=' + fromTimestamp + '&' +
               'to=' + toTimestamp + '&' +
               'api_key=' + apiKey + '&' +
               'format=json',
        dataType: 'jsonp',
        success: function(data) {
            if (!working || name != username)
                return;
            if (!data.weeklyartistchart) {
                working = false;
                showError("Failed to fetch weekly chart for " + name + ". Check username.");
                return;
            }
            artistChartsByUser[name][cachekey] = data;
            callback(data);
        },
        error: function(code, message){
            if (!working)
                return;
            working = false;
            showError("Failed to fetch charts: " + message);
        }}
    );
}

function getArtistID(artist) {
    if (artist.mbid)
        return artist.mbid;
    else
        return simplifyString(artist.name);
}

function getArtistNameID(artistname) {
    return "artist-" + simplifyString(artistname);
}


// STRING STUFF

function simplifyString(s) {
    return s.toLowerCase().replace(/[ &\.\/\']/g, "");
}


// SVG STUFF

function setupSVG() {
    // TODO limit width by number of data points on x, max ~300 px per point
    var	margin = getChartMargin(),
        width = getChartWidth(),
        height = getChartHeight();
    
    var	svg = d3.select("#sec_vis")
        .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
        .append("g")
            .attr("class", "visarea")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    
    var tooltip = d3.select("#sec_vis").append("div")	
        .attr("class", "tooltip")
        .attr("id", "tooltip")
        .style("opacity", 0);
            
    return svg;
}

function showTooltip(x, y, d, valuesuffix) {
    d3.select("#tooltip").transition()		
        .duration(200)		
        .style("opacity", .9);
    d3.select("#tooltip")
        .style("left", (d3.event.pageX - 50) + "px")		
        .style("top", (d3.event.pageY + 10) + "px");
    var visoffset = $(".visarea").offset();
    var relX = d3.event.pageX - visoffset.left;
    var relY = d3.event.pageY - visoffset.top;
    var year = x.invert(relX).getFullYear();
    var value = Math.max(0, Math.min(100, Math.round(y.invert(relY)))) + valuesuffix;
    d3.select("#tooltip").html(d.name + "<br/>" + year + "<br/>" + value);
}

function hideTooltip() {
    d3.select("#tooltip").transition()		
        .duration(300)		
        .style("opacity", 0);	
}

function onPathMouseOver(elem, d) {
    d3.select("svg").classed("highlighted", true);
    d3.select(elem).classed("highlighted", true);
    d3.select(elem.parentNode).select(".tagname").classed("highlighted", true);
};

function onPathMouseOut(elem, d) {
    d3.select("svg").classed("highlighted", false);
    d3.selectAll(".highlightable").classed("shadowed", false);
    d3.select(elem).classed("highlighted", false);
    d3.select(elem.parentNode).select(".tagname").classed("highlighted", false);
}

function onLabelMouseOver(d) {
    d3.select("svg").classed("highlighted", true);
    d3.select(this).classed("highlighted", true);
    d3.select(this.parentNode).select(".tagline").classed("highlighted", true);
}

function onLabelMouseOut(d) {
    d3.select("svg").classed("highlighted", false);
    d3.select(this).classed("highlighted", false);
    d3.select(this.parentNode).select(".tagline").classed("highlighted", false);
}

function getChartWidth() {
    var margin = getChartMargin();
    return getMaxVisWidth() - margin.left - margin.right;
}

function getChartHeight() {
    var margin = getChartMargin();
    return getMaxVisHeight() - margin.top - margin.bottom;;
}

function getChartMargin() {
    return {top: 20, right: 150, bottom: 30, left: 25};
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
        height -= 100;
    
    if (height > 1000)
        height = 1000;
    if (height < 200)
        height = 200;
    return height;
}
