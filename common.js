
// LAST.FM STUFF

var apiKey = '3ef6e7e91fadb29f8653958588f47c23';

// keep between visualizations
var chartsByUser = {};
var artistChartsByUser = {};

// constants
var minWeeklyArtistPlayCount = 1;
var binTypeYears = "years";
var binTypeMonths = "months";

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
	
	var maxYears = maxperiod == "overall" ? 20 : parseInt(maxperiod) || 20;
    
    console.log("Fetching weekly artists charts for " + username + " (max period: " + maxperiod + ", max years: " + maxYears + ")");
    
	var maxWeeklyChartsToFetch = maxYears * 52;
    var chartsToGet = Math.min(charts.chart.length, maxWeeklyChartsToFetch);
    var chartsDone = 0;
    var artistsByYear = {};
    var artistsByMonth = {};
    var artistsByIDYear = {};
    var artistsByIDMonth = {};
    
    var onWeekDone = function (data) {
        if (!working)
            return;
        
        chartsDone++;
        showLoaded(chartsDone / chartsToGet * loadingProcessFactor);
        
        var date = new Date(data.weeklyartistchart['@attr'].from * 1000);
        var year = parseInt(date.getFullYear());
        var month = year + "-" + (date.getMonth() + 1);
        
        var maxArtists = Math.min(data.weeklyartistchart.artist.length, maxWeeklyArtists);
        for (var j = 0; j < maxArtists; j++) {
            var artist = data.weeklyartistchart.artist[j];
            if (artist.playcount < minWeeklyArtistPlayCount)
                continue;            
            
            // initialize list entries
            if (!artistsByYear[year])
                artistsByYear[year] = [];
            if (!artistsByMonth[month])
                artistsByMonth[month] = [];
            
            if (!artistsByIDYear[year])
                artistsByIDYear[year] = {};
            if (!artistsByIDMonth[month])
                artistsByIDMonth[month] = {};
            
            var artistID = getArtistID(artist);
            
            // track yearly playcounts
            var existingartist = artistsByIDYear[year][artistID];
            if (!existingartist) {
                artistsByIDYear[year][artistID] = artist;
                artistsByYear[year].push(artist);
                artist.totalplaycount = parseInt(artist.playcount);
            } else {
                existingartist.totalplaycount += parseInt(artist.playcount);
            }
            
            // track monthly playcounts
            existingartist = artistsByIDMonth[month][artistID];
            if (!existingartist) {
                artistsByIDMonth[month][artistID] = artist;
                artistsByMonth[month].push(artist);
                artist.totalplaycount = parseInt(artist.playcount);
            } else {
                existingartist.totalplaycount += parseInt(artist.playcount);
            }
        }
        
        if (chartsDone == chartsToGet) {
            var binType = Object.keys(artistsByIDYear).length > 2 ? binTypeYears : binTypeMonths;
            var artistsByBin = binType === binTypeMonths ? artistsByMonth : artistsByYear;
            for (var y in artistsByBin) {
                artistsByBin[y].sort(function(a, b) {
                    return b.totalplaycount - a.totalplaycount;
                });
            }
            console.log("bin type: " + binType);
            console.log(artistsByBin);
            doneCallback(artistsByBin, binType);
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

function getAlbumID(album) {
    if (album.mbid) 
        return album.mbid;
    else
        return getArtistID(album.artist) + "-" + simplifyString(album.name);
}

function getTrackID(track) {
    if (track.mbid) 
        return track.mbid;
    else
        return getArtistID(track.artist) + "-" + simplifyString(track.name);
    
}

function getArtistNameID(artistname) {
	if (!artistname) return null;
    return "artist-" + simplifyString(artistname);
}

function sortBins(binType) {
    if (binType === binTypeYears) {        
        return function (a, b) {
            return (a - b);
        };
    }
    
    return function (a, b) {
        var valA = parseInt(a.split("-")[0]*12) + parseInt(a.split("-")[1]);
        var valB = parseInt(b.split("-")[0]*12) + parseInt(b.split("-")[1]);
        return valA - valB;
    };
}


// STRING STUFF

function simplifyString(s) {
	if (!s) return "";
    return s.toLowerCase().replace(/[ &\.\/\']/g, "");
}


// SVG STUFF

function setupSVG(numBins) {
    var	margin = getChartMargin(),
        width = getChartWidth(numBins),
        height = getChartHeight(numBins);
    
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
    
    tooltip.append("span")
        .attr("class", "tooltip-row tooltip-line");
    tooltip.append("span")
        .attr("class", "tooltip-row tooltip-x");
    tooltip.append("span")
        .attr("class", "tooltip-row tooltip-y");
    tooltip.append("span")
        .attr("class", "tooltip-row tooltip-details");
            
    return svg;
}

function showTooltip(x, y, d, valuesuffix, details, binType) {
    d3.select("#tooltip").transition()		
        .duration(200)		
        .style("opacity", .9);
    d3.select("#tooltip")
        .style("left", (d3.event.pageX - 60) + "px")		
        .style("top", (d3.event.pageY + 10) + "px");
        
    var bin = getInputEventBin(x, binType);
    
    var value = "??";
    if (d.bins) {
        var bini = getBinIndex(d.bins, bin);
        value = bini >= 0 ? d.bins[bini].value : "??";
    } else {
        value = d.value;
    }
    
    d3.select("#tooltip .tooltip-line").html(d.name);
    d3.select("#tooltip .tooltip-x").html(bin);
    d3.select("#tooltip .tooltip-y").html(Math.round(value) + valuesuffix);
    d3.select("#tooltip .tooltip-details").html(details ? details : "");
    d3.select("#tooltip .tooltip-details").style("display", details ? "block" : "none");
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
    d3.select(elem.parentNode).select(".tagline").classed("highlighted", true);
    d3.select(elem.parentNode).selectAll(".dot").classed("highlighted", true);
};

function onPathMouseOut(elem, d) {
    d3.select("svg").classed("highlighted", false);
    d3.selectAll(".highlightable").classed("shadowed", false);
    d3.select(elem).classed("highlighted", false);
    d3.select(elem.parentNode).select(".tagname").classed("highlighted", false);
    d3.select(elem.parentNode).select(".tagline").classed("highlighted", false);
    d3.select(elem.parentNode).selectAll(".dot").classed("highlighted", false);
}

function onLabelMouseOver(d) {
    d3.select("svg").classed("highlighted", true);
    d3.select(this).classed("highlighted", true);
    d3.select(this.parentNode).select(".tagline").classed("highlighted", true);
    d3.select(this.parentNode).selectAll(".dot").classed("highlighted", true);
}

function onLabelMouseOut(d) {
    d3.select("svg").classed("highlighted", false);
    d3.select(this).classed("highlighted", false);
    d3.select(this.parentNode).select(".tagline").classed("highlighted", false);
    d3.select(this.parentNode).selectAll(".dot").classed("highlighted", false);
}

function getInputEventBin(x, binType) {
    var visoffset = $(".visarea").offset();
    var relX = d3.event.pageX - visoffset.left;
    var date = x.invert(relX);
    var bin = binType === binTypeYears ? date.getFullYear() : date.getFullYear() + "-" + (date.getMonth() + 1);
    return bin;
}

function getBinIndex(bins, bin) {
    var bini = -1;
    for (var i = 0; i < bins.length; i++) {
        if (bins[i].bin == bin)
            bini = i;
    }
    return bini;
}

function clearLinesOutsideGraph(width, height) {
    d3.select(".visarea").append("rect")
        .attr("x", 0)
        .attr("y", height)
        .attr("width", width)
        .attr("height", 30)
        .style("fill", "white");
}

function getChartWidth(numBins) {
    var margin = getChartMargin();
    var maxwidthperbin = getChartHeight(numBins);
    var viswidth = Math.min(maxwidthperbin * (numBins - 1), getMaxVisWidth());
    return viswidth - margin.left - margin.right;
}

function getChartHeight(numBins) {
    var margin = getChartMargin();
    return getMaxVisHeight() - margin.top - margin.bottom;
}

function getChartMargin() {
    var w = getMaxVisWidth();
    return {top: 10, right: Math.min(150, w / 4), bottom: 25, left: 25};
}

function getMaxVisWidth() {
    var width = $("#sec_vis").width();
    if (!width) 
        width = 600;
    return width;
}

function getMaxVisHeight() {
    var height = Math.min($(window).height(), $(window).width());
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
