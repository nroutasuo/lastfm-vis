/**
* Artist Timeline visualization
* Last.fm tools by Noora Routasuo
* Built with D3.js (https://d3js.org/)
* Last.fm (https://www.last.fm/api)
*/

var maxArtistTimelineLines = 300;
var maxWeeklyArtistCount = 100;

function makeArtistTimeline(username) {
    var onChartsDone = function (data) {
        if (!working)
            return;
        fetchWeeklyArtistCharts(username, data.weeklychartlist, buildArtistTimelineVis, 100, maxWeeklyArtistCount);
    }
    fetchWeeklyCharts(username, onChartsDone);
}

function buildArtistTimelineVis(artistsByBin, binType) {
    if (!working)
        return;
    
    stopLoading("Done.", "");
    console.log("Building timeline..");
    clearVis();
    
    // Set up data
    var bins = Object.keys(artistsByBin).sort(sortBins(binType));
    var lastbin = bins[bins.length -1];
    var datas = GetArtistTimelineData(artistsByBin, binType);
    var dataByBin = datas.byBin;
    var dataByArtist = datas.byArtist;
    // TODO based on what to filter artists?
    var dataByArtistFiltered = dataByArtist.slice(0, maxArtistTimelineLines);
    
    // Set up SVH
    var svg = setupSVG(bins.length);
    var height = getChartHeight(bins.length);
    var width = getChartWidth(bins.length);
     
    // Set the ranges    
    var	parseDate = d3.time.format("%Y-%m-%d").parse;
    var	x = d3.time.scale().range([0, width]);
	x.domain(d3.extent(dataByBin, function(d) { return parseDate(d.date); }));
    var	y = d3.scale.linear().domain([0, datas.maxplaycount]).range([height, 0]);
     
    // Define the line
    var	artistline = d3.svg.line()
        .interpolate("cardinal")
        .tension(0.9)
        .x(function(d) { return x(parseDate(d.date)); })
        .y(function(d) { return y(d.count) });
        
    // Add artists
    var artist = svg.selectAll(".artist")
        .data(dataByArtistFiltered)
        .enter().append("g")
            .attr("class", "artist")
            .attr("artist", function (d) { return getArtistNameID(d.name); });
    
    artist.append("path")
        .attr("class", "tagline highlightable")
        .attr("artist", function (d) { return d.name; })
        .attr("d", function(d) { return artistline(d.bins); })
        .on("mouseover", function (d) { 
            onPathMouseOver(this, d);
            showTooltip(x, y, d, " plays", "");
        })
        .on("mouseout", function (d) { 
            onPathMouseOut(this, d);
            hideTooltip();
        });
        
    clearLinesOutsideGraph(width, height);
    
    artist.selectAll(".dot")
        .data(function (d) { return d.bins })
        .enter().append("circle")
        .attr("class", "dot highlightable")
        .attr("cx", function (d) { return x(parseDate(d.date)); } )
        .attr("cy", function (d) { return y(d.count); } )
        .on("mouseover", function (d) { 
            onPathMouseOver(this, d);
            showTooltip(x, y, d, " plays", "");
        })
        .on("mouseout", function (d) { 
            onPathMouseOut(this, d);
            hideTooltip();
        });
      
    artist.append("text")
        .attr("class", "tagname highlightable")
        .attr("transform", function (d) { return "translate(" + width + "," + y(d.bins[d.bins.length-1].count) + ")"})
        .attr("x", 4)
        .attr("dy", "0.35em")
        .style("font", "11px sans-serif")
        .text(function(d) { return d.name })
        .on("mouseover", onLabelMouseOver)
        .on("mouseout", onLabelMouseOut);
 
	// Add the axes
    var	xAxis = d3.svg.axis().scale(x);
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

function GetArtistTimelineData(artistsByBin, binType) {    
    var dataByArtist = [];
    var dataByBin = [];
    var dataByArtistMapped = {};
    
    var bins = Object.keys(artistsByBin).sort(sortBins(binType));
    var maxplaycount = 0;
    
    var makeDate = function(bin) {
        if (binType === binTypeYears)
            return bin + "-01" + "-01";
        return bin + "-01";
    }
    
    var getOrCreateArtistItem = function (artist) {
        var artistID = getArtistID(artist);
        if (!dataByArtistMapped[artistID]) {
            var dt = {};
            dt.name = artist.name;
            dt.bins = [];
            for (var i = 0; i < bins.length; i++) {
                dt.bins[i] = {};
                dt.bins[i].bin = parseInt(bins[i]);
                dt.bins[i].date = makeDate(bins[i]);
                dt.bins[i].count = 0;
                dt.bins[i].name = dt.name;
            }
            dataByArtistMapped[artistID] = dt;
            dataByArtist.push(dt);
        }
        return dataByArtistMapped[artistID];
    };
    
    var bin;
    for (var i = 0; i < bins.length; i++) {
        bin = bins[i];
        var dy = {};
        dy.bin = parseInt(bin);
        dy.date = makeDate(bin);
        dy.artists = {};
        dy.maxcount = 0;
        for (var j = 0; j < artistsByBin[bin].length; j++) {
            var artist = artistsByBin[bin][j];
            var artistID = getArtistID(artist);
            var dt = getOrCreateArtistItem(artist);
            var count = artist.totalplaycount;
            dt.bins[i].count = count;
            dt.bins[i].value = count;
            dy.artists[artistID] = count;
            if (count > dy.maxcount)
                dy.maxcount = count;
            if (count > maxplaycount)
                maxplaycount = count;
        }
        dataByBin.push(dy);
    }
    
    var lastbin = bins.length -1;
    dataByArtist = dataByArtist.sort(function (a,b) {
        var valA = a.bins[lastbin] ? a.bins[lastbin].count : 0;
        var valB = b.bins[lastbin] ? b.bins[lastbin].count : 0;
        return valB - valA;
    });
    
    console.log("timeline data:");
    console.log(dataByArtist);
    console.log(dataByBin);
    return { byBin : dataByBin, byArtist: dataByArtist, maxplaycount: maxplaycount };
}
