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
        fetchWeeklyArtistCharts(username, data.weeklychartlist, buildArtistTimelineVis, 100, maxWeeklyArtistCount);
    }
    fetchWeeklyCharts(username, onChartsDone);
}

function buildArtistTimelineVis(artistsByYear) {
    if (!working)
        return;
    
    stopLoading("Done.", "");
    console.log("Building timeline..");
    clearVis();
    
    console.log(artistsByYear);
    
    var svg = setupSVG();
    var height = getChartHeight();
    var width = getChartWidth();
    
    // Set up data
    var years = Object.keys(artistsByYear);
    var lastyear = years[years.length -1];
    var datas = GetArtistTimelineData(artistsByYear);
    var dataByYear = datas.byYear;
    var dataByArtist = datas.byArtist;
    // TODO based on what to filter artists?
    var dataByArtistFiltered = dataByArtist.slice(0, maxArtistTimelineLines);
    
    var	parseDate = d3.time.format("%Y-%m").parse;
     
    // Set the ranges
    var	x = d3.time.scale().range([0, getChartWidth()]);
	x.domain(d3.extent(dataByYear, function(d) { return parseDate(d.date); }));
    var	y = d3.scale.linear().domain([0, datas.maxplaycount]).range([height, 0]);
     
    // Define the line
    var	artistline = d3.svg.line()
        .interpolate("cardinal")
        .tension(0.8)
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
        .attr("d", function(d) { return artistline(d.years); })
        .on("mouseover", function (d) { 
            onPathMouseOver(this, d);
            showTooltip(x, y, d, " plays");
        })
        .on("mouseout", function (d) { 
            onPathMouseOut(this, d);
            hideTooltip();
        });
    
    artist.append("text")
        .attr("class", "tagname highlightable")
        .attr("transform", function (d) { return "translate(" + width + "," + y(d.years[d.years.length-1].count) + ")"})
        .attr("x", 3)
        .attr("dy", "0.35em")
        .style("font", "11px sans-serif")
        .text(function(d) { return d.name })
        .on("mouseover", onLabelMouseOver)
        .on("mouseout", onLabelMouseOut);
 
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

function GetArtistTimelineData(artistsByYear) {    
    var dataByArtist = [];
    var dataByYear = [];
    var dataByArtistMapped = {};
    
    var years = Object.keys(artistsByYear);
    var maxplaycount = 0;
    
    var getOrCreateArtistItem = function (artist) {
        var artistID = getArtistID(artist);
        if (!dataByArtistMapped[artistID]) {
            var dt = {};
            dt.name = artist.name;
            dt.years = [];
            for (var i = 0; i < years.length; i++) {
                dt.years[i] = {};
                dt.years[i].year = years[i];
                dt.years[i].date = years[i] + "-6";
                dt.years[i].count = 0;
            }
            dataByArtistMapped[artistID] = dt;
            dataByArtist.push(dt);
        }
        return dataByArtistMapped[artistID];
    };
    
    var year;
    for (var i = 0; i < years.length; i++) {
        year = years[i];
        var dy = {};
        dy.year = year;
        dy.date = year + "-6";
        dy.artists = {};
        dy.maxcount = 0;
        for (var j = 0; j < artistsByYear[year].length; j++) {
            var artist = artistsByYear[year][j];
            var artistID = getArtistID(artist);
            var dt = getOrCreateArtistItem(artist);
            var count = artist.totalplaycount;
            dt.years[i].count = count;
            dy.artists[artistID] = count;
            if (count > dy.maxcount)
                dy.maxcount = count;
            if (count > maxplaycount)
                maxplaycount = count;
        }
        dataByYear.push(dy);
    }
    
    var lastyear = years[years.length -1];
    dataByArtist = dataByArtist.sort(function (a,b) {
        var valA = a[lastyear] ? a[lastyear].count : 0;
        var valB = b[lastyear] ? b[lastyear].count : 0;
        return valB - valA;
    });
    
    console.log("timeline data:");
    console.log(dataByArtist);
    console.log(dataByYear);
    return { byYear : dataByYear, byArtist: dataByArtist, maxplaycount: maxplaycount };
}
