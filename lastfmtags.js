/**
* Tag Cloud and Tag Timeline visualizations
* Last.fm tools by Noora Routasuo
* Built with D3.js (https://d3js.org/)
* Last.fm (https://www.last.fm/api)
*/

// constants
var maxWeeklyTagArtistCount = 25; 
var maxPeriodArtistCount = 500;
var maxTimelineBinArtistCount = 250;
var maxTagsInCloud = 50;
var maxTagTimelineLines = 100;

// keep between visualizations
var tagsByArtist = {};
var tagsByAlbum = {};
var tagsByTrack = {};
var topArtists = {};
var topAlbums = {};
var topTracks = {};

// reset depending on selections
var tagsPerBin = {};
var filteredTags = [];

function makeTagCloud(username, count, period) {
    filteredTags = [];
    var onArtistsDone = function (data) {
        fetchTagsForCloud(data, username, count, period);
    }
    fetchTopArtists(username, count, period, onArtistsDone);
}

function makeTagTimeline(username) {
    tagsPerBin = {};
    filteredTags = [];
    var onChartsDone = function (data) {
        if (!working)
            return;
        fetchWeeklyArtistCharts(username, data.weeklychartlist, fetchTagsByBin, 50, maxWeeklyTagArtistCount);
    }
    fetchWeeklyCharts(username, onChartsDone);
}

function makeSubTagCloud(event, username, count, period, tag) {
    console.log("making sub tag cloud: " + username + ", " + count + ", " + period + " " + tag);
    showLoaded(0);
    
    var artists = null;
    var albums = null;
    var tracks = null;
    var maxlen = 25;
    
    var numalbums = 0;
    var albumsready = 0;
    var numtracks = 0;
    var tracksready = 0;
    
    var updateLoaded = function () {
        var percentage = 0;
        if (artists) percentage += 20;
        if (albums) percentage += 40;
        if (tracks) percentage += 40;
        showLoaded(percentage);
    }
    
    var checkReady = function () {
        updateLoaded();
        if (artists && albums && albumsready == numalbums && tracks && tracksready == numtracks) {
            stopLoading("Done", "");
            buildSubCloudVis(artists, albums, tracks);
        }
    }
    
    var onArtistsDone = function (data) {
        console.log("got " + data.topartists.artist.length + " artists");
        artists = [];
        for (var i = 0; i < data.topartists.artist.length; i++) {
            if (artists.length >= maxlen) break;
            var artist = data.topartists.artist[i];
            var artistID = getArtistID(artist);
            var tags = tagsByArtist[artistID];
            if (!tags) continue;
            var artisttaglist = tags.toptags.tag;
            for (var j = 0; j < artisttaglist.length; j++) {
                tagname = cleanupTagName(artisttaglist[j].name);
                if (tagname == tag) {
                    artists.push(artist);
                    break;
                }
            }
            
        }
        checkReady();
    };
    
    var onAlbumsDone = function (data) {
        console.log("got " + data.topalbums.album.length + " albums");
        albums = [];
        numalbums = Math.min(data.topalbums.album.length, maxlen);
        albumsready = 0;
        var onAlbumTagsReady = function (album) {
            albumsready++;
            var albumID = getAlbumID(album);
            tags = tagsByAlbum[albumID];
            if (tags) {
                var albumtagslist = tags.toptags.tag;
                for (var j = 0; j < albumtagslist.length; j++) {
                    tagname = cleanupTagName(albumtagslist[j].name);
                    if (tagname == tag) {
                        albums.push(album);
                        break;
                    }
                }
            }
            if (albumsready == numalbums) checkReady();
        };
        for (var i = 0; i < numalbums; i++) {   
            var album = data.topalbums.album[i];       
            fetchTagsForAlbum(album, null, onAlbumTagsReady);
        }
    };
    
    var onTracksDone = function (data) {
        console.log("got " + data.toptracks.track.length + " tracks");
        tracks = [];
        numtracks = Math.min(data.toptracks.track.length, maxlen);
        tracksready = 0;
        var onTrackTagsReady = function (track) {
            tracksready++;
            var trackID = getTrackID(track);
            tags = tagsByTrack[trackID];
            if (tags) {
                var tracktaglist = tags.toptags.tag;
                for (var j = 0; j < tracktaglist.length; j++) {
                    tagname = cleanupTagName(tracktaglist[j].name);
                    if (tagname == tag) {
                        tracks.push(track);
                        break;
                    }
                }
            }
            if (tracksready == numtracks) checkReady();
        };
        for (var i = 0; i < numtracks; i++) {   
            var track = data.toptracks.track[i];       
            fetchTagsForTrack(track, null, onTrackTagsReady);
        }
    };
    
    
    fetchTopArtists(username, count, period, onArtistsDone);
    fetchTopAlbums(username, count, period, onAlbumsDone);
    fetchTopTracks(username, count, period, onTracksDone);
}

function fetchTopArtists(username, count, period, callback) {
    count = Math.min(count, maxPeriodArtistCount);
    var cachekey = username + "-" + count + "-" + period;
    if (topArtists[cachekey]) {
        callback(topArtists[cachekey]);
        return;
    }
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
            topArtists[cachekey] = data;
            callback(data);
        },
        error: function(code, message){
            console.log("Failed to fetch top artists.");
            showError("Failed to fetch top artists");
        }}
    );
}

function fetchTopAlbums(username, count, period, callback) {
    count = Math.min(count, maxPeriodArtistCount);
    var cachekey = username + "-" + count + "-" + period;
    if (topAlbums[cachekey]) {
        callback(topAlbums[cachekey]);
        return;
    }
    console.log("Fetching " + count + " top " + period + " albums for " + username + "...");
    $.ajax({ 
        type: 'POST',
        url: 'https://ws.audioscrobbler.com/2.0/',
        data: 'method=user.gettopalbums&' +
               'user=' + username + '&' +
               'limit=' + count + '&' +
               'period=' + period + '&' +
               'api_key=' + apiKey + '&' +
               'format=json',
        dataType: 'jsonp',
        success: function(data) {
            console.log("Top albums fetched!");
            topAlbums[cachekey] = data;
            callback(data);
        },
        error: function(code, message){
            console.log("Failed to fetch top albums.");
            showError("Failed to fetch top albums");
        }}
    );
}

function fetchTopTracks(username, count, period, callback) {
    count = Math.min(count, maxPeriodArtistCount);
    var cachekey = username + "-" + count + "-" + period;
    if (topTracks[cachekey]) {
        callback(topTracks[cachekey]);
        return;
    }
    console.log("Fetching " + count + " top " + period + " tracks for " + username + "...");
    $.ajax({ 
        type: 'POST',
        url: 'https://ws.audioscrobbler.com/2.0/',
        data: 'method=user.gettoptracks&' +
               'user=' + username + '&' +
               'limit=' + count + '&' +
               'period=' + period + '&' +
               'api_key=' + apiKey + '&' +
               'format=json',
        dataType: 'jsonp',
        success: function(data) {
            console.log("Top tracks fetched!");
            topTracks[cachekey] = data;
            callback(data);
        },
        error: function(code, message){
            console.log("Failed to fetch top tracks.");
            showError("Failed to fetch top tracks");
        }}
    );
}

function fetchTagsForCloud(artists, username, count, period) {
    var totalartists = artists.topartists.artist.length;
    var artistsready = 0;
    
    var onArtistReady = function (artist, data) {
        artistsready++;
        showLoaded(artistsready / totalartists * 100);
        if (artistsready == totalartists) {
            buildCloudVis(artists, username, count, period);
        }
    };
    
    var artist;
    for (var i = 0; i < totalartists; i++) {
        artist = artists.topartists.artist[i];
        fetchTagsForArtist(artist, null, onArtistReady);
    }
}

function fetchTagsByBin(artistsByBin, binType) {
    tagsPerBin = {};
    fetchTagsForBin(Object.keys(artistsByBin)[0], artistsByBin, binType);
}

function fetchTagsForBin(bin, artistsByBin, binType) {
    if (!working)
        return;
    
    var artistlist = artistsByBin[bin];
    artistlist = artistlist.sort(function(a, b) {
        return b.totalplaycount - a.totalplaycount;
    });
    
    var maxArtists = Math.min(artistlist.length, maxTimelineBinArtistCount);
    console.log("Fetching tags for " + maxArtists + " / " + artistlist.length + " artists for the bin " + bin);
    
    var keys = Object.keys(artistsByBin);
    var binIndex = keys.indexOf(bin);

    var totalartists = maxArtists;
    var artistsready = 0;
    
    tagsPerBin[bin] = {};
    
    var onArtistOK = function (artist, data) {
        tagsPerBin[bin][getArtistID(artist)] = data;
    };
    
    var onArtistReady = function (artist) {
        artistsready++;
        var binPercentage = binIndex / keys.length;
        binPercentage += artistsready / totalartists / keys.length;
        showLoaded(50 + binPercentage * 50);
        if (artistsready == totalartists) {
            if (binIndex > 0) 
                buildTagTimelineVis(artistsByBin, binType);
                
            if (binIndex < keys.length - 1) {
                fetchTagsForBin(keys[binIndex + 1], artistsByBin, binType);
            } else {
                stopLoading("Done.", "");
            }
        }
    };

    var artist;
    for (var i = 0; i < totalartists; i++) {
        artist = artistlist[i];
        fetchTagsForArtist(artist, onArtistOK, onArtistReady);
    }
    
    if (totalartists === 0) {
        delete tagsPerBin[bin];
        totalartists = 1;
        onArtistReady();
    }
}

function fetchTagsForArtist(artist, okCallback, responseCallback) {
    if (tagsByArtist[getArtistID(artist)]) {
        if (okCallback)
            okCallback(artist, tagsByArtist[getArtistID(artist)]);
        responseCallback(artist);
        return;
    }
    
    console.log("Fetching tags for artist " + artist.name);
    
    var showCallError = function () {
        console.log("Failed to fetch tags for " + artist.name + ".");
        showError("Failed to fetch tags for " + artist.name + ".");
    }
    
    $.ajax({
        type: 'POST',
        url: 'https://ws.audioscrobbler.com/2.0/',
        data: 'method=artist.gettoptags&' +
           'artist=' + encodeURIComponent(artist.name) + '&' + 
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

function fetchTagsForAlbum(album, okCallback, responseCallback) {
    if (tagsByAlbum[getAlbumID(album)]) {
        if (okCallback)
            okCallback(album, tagsByAlbum[getAlbumID(album)]);
        responseCallback(album);
        return;
    }
    
    console.log("Fetching tags for album " + album.name);
    
    var showCallError = function () {
        console.log("Failed to fetch tags for " + album.name + ".");
        showError("Failed to fetch tags for " + album.name + ".");
    }
    
    $.ajax({
        type: 'POST',
        url: 'https://ws.audioscrobbler.com/2.0/',
        data: 'method=album.gettoptags&' +
           'album=' + encodeURIComponent(album.name) + '&' + 
           'artist=' + encodeURIComponent(album.artist.name) + '&' +
           'mbid=' + album.mbid + '&' +
           'api_key=' + apiKey + '&' +
           'format=json',
        dataType: 'jsonp',
        success: function(data) {
            if (data.toptags) {
                tagsByAlbum[getAlbumID(album)] = data;
                if (okCallback)
                    okCallback(album, data);
            } else {
                showCallError();
            }
            responseCallback(album);
        },
        error: function(code, message){
            showCallError();
            responseCallback(album);
        }
    });
}

function fetchTagsForTrack(track, okCallback, responseCallback) {
    if (tagsByTrack[getTrackID(track)]) {
        if (okCallback)
            okCallback(track, tagsByTrack[getTrackID(track)]);
        responseCallback(track);
        return;
    }
    
    var showCallError = function () {
        console.log("Failed to fetch tags for " + track.name + ".");
        showError("Failed to fetch tags for " + track.name + ".");
    }
    
    $.ajax({
        type: 'POST',
        url: 'https://ws.audioscrobbler.com/2.0/',
        data: 'method=track.gettoptags&' +
           'track=' + encodeURIComponent(track.name) + '&' + 
           'artist=' + encodeURIComponent(track.artist.name) + '&' +
           'mbid=' + track.mbid + '&' +
           'api_key=' + apiKey + '&' +
           'format=json',
        dataType: 'jsonp',
        success: function(data) {
            if (data.toptags) {
                tagsByTrack[getTrackID(track)] = data;
                if (okCallback)
                    okCallback(track, data);
            } else {
                showCallError();
            }
            responseCallback(track);
        },
        error: function(code, message){
            showCallError();
            responseCallback(track);
        }
    });
}

function buildCloudVis(artists, username, count, period) {
    if (!working)
        return;
    
    console.log("Building vis...")
    var counts = getTagCounts(tagsByArtist, artists.topartists.artist);
    var tagcounts = counts.counts;
    var tagcounttotal = counts.total;
    var sortedNames = getSortedTagNames(tagcounts, maxTagsInCloud);
    
    clearVis();
    clearSubVis();
    
    $("#sec_vis").append("<ul>");
    for (var i = 0; i < sortedNames.length; i++) {
        var tagname = sortedNames[i];
        var tagcount = tagcounts[tagname];
        var tagsize = Math.round(tagcount / tagcounttotal * 500);
        tagsize = Math.max(Math.min(10, tagsize), 1);
        var tagclass = "tag-size-" + tagsize;
        var subTagCloudArgs = "event, '" + username + "', '" + count + "', '" + period + "', '" + tagname + "'";
        var li = $("<li class='tag " + tagclass + "'><button onclick=\"makeSubTagCloud(" + subTagCloudArgs +")\">" + tagname + "</button></li>");
        $("#sec_vis ul").append(li);
    }
    
    stopLoading("Done.", "");
}

function buildTagTimelineVis(artistsByBin, binType) {
    if (!working)
        return;
    
    console.log("Building timeline..");
    clearVis();
    
    // Set up data    
    var bins = Object.keys(tagsPerBin).sort(sortBins(binType));
    var lastBin = bins[bins.length -1];
    var datas = GetTimelineData(artistsByBin, tagsPerBin, binType);
    var dataByBin = datas.byBin;
    var dataByTag = datas.byTag;
    var dataByTagFiltered = dataByTag.slice(0, maxTagTimelineLines);
    
    // Set up SVG
    var svg = setupSVG(bins.length);
    var height = getChartHeight(bins.length);
    var width = getChartWidth(bins.length);
     
    // Set the ranges    
    var	parseDate = d3.time.format("%Y-%m").parse;
    var	x = d3.time.scale().range([0, width]);
	x.domain(d3.extent(dataByBin, function(d) { return parseDate(d.date); }));
    var	y = d3.scale.linear().domain([0, 100]).range([height, 0]);
     
    // Define the line
    var	tagline = d3.svg.line()
        .interpolate("cardinal")
        .tension(0.9)
        .x(function(d) { return x(parseDate(d.date)); })
        .y(function(d) { return y(d.relativecount) });
 
    // Add the tags
    var getArtistsString = function (d) {
        var result = "";
        for (var i = 0; i < Math.min(d.artists.length, 3); i++) {
            result += (i + 1) + ") " + d.artists[i].name + " (" + d.artists[i].totalplaycount + " plays)<br/>";
        }
        return result;
    };
    
    var tag = svg.selectAll(".tag")
        .data(dataByTagFiltered)
        .enter().append("g")
            .attr("class", "tag")
            .attr("tag", function (d) { return d.name; });
    
    tag.append("path")
        .attr("class", "tagline highlightable")
        .attr("tag", function (d) { return d.name; })
        .attr("d", function(d) { return tagline(d.bins); })
        .on("mouseover", function (d) {
            var bin = getInputEventBin(x, binType);
            var bini = getBinIndex(d.bins, bin);
            onPathMouseOver(this, d);
            showTooltip(x, y, d, "%", getArtistsString(d.bins[bini]), binType);
        })
        .on("mouseout", function (d) { 
            onPathMouseOut(this, d);
            hideTooltip();
        });
        
    clearLinesOutsideGraph();
    
    tag.selectAll(".dot")
        .data(function (d) { return d.bins })
        .enter().append("circle")
        .attr("class", "dot highlightable")
        .attr("cx", function (d) { return x(parseDate(d.date)); } )
        .attr("cy", function (d) { return y(d.relativecount); } )
        .on("mouseover", function (d) {
            onPathMouseOver(this, d);
            showTooltip(x, y, d, "%", getArtistsString(d), binType);
        })
        .on("mouseout", function (d) { 
            onPathMouseOut(this, d);
            hideTooltip();
        });
    
    tag.append("text")
        .attr("class", "tagname highlightable")
        .attr("transform", function (d) { 
            return "translate(" + width + "," + y(d.bins[d.bins.length-1].relativecount) + ")";
        })
        .attr("x", 4)
        .attr("dy", "0.35em")
        .style("font", "0.85em sans-serif")
        .text(function(d) { return d.name })
        .on("mouseover", onLabelMouseOver)
        .on("mouseout", onLabelMouseOut);
 
	// Add the axes
    var	xAxis = d3.svg.axis().scale(x).ticks(bins.length);
    var	yAxis = d3.svg.axis().scale(y).orient("left").ticks(5);
	svg.append("g")
		.attr("class", "x axis")
		.attr("transform", "translate(0," + height + ")")
		.call(xAxis);
	svg.append("g")		
		.attr("class", "y axis")
        .attr("transform", "translate(0,0)")
		.call(yAxis);
}

function buildSubCloudVis(artists, albums, tracks) {
    console.log("Building subvis...")
    
    clearSubVis();
    
    var container = $("<div class='flex-container'>").appendTo($("#sec_sub_vis"));
    
    var appendToCloud = function (name, ul) {
        var tagclass = "tag-size-2";
        var li = $("<li class='tag " + tagclass + "'><span>" + name + "</span></li>");
        ul.append(li);
    }
    
    
    container.append("<ul id='sub-tag-cloud-artists' class='subcloud flex-item'>");
    var ulartists = $("#sub-tag-cloud-artists");
    for (var i = 0; i < artists.length; i++) {
        var artist = artists[i];
        appendToCloud(artist.name, ulartists);
    }
    
    container.append("<ul id='sub-tag-cloud-albums' class='subcloud flex-item'>");
    var ulalbums = $("#sub-tag-cloud-albums");
    for (var i = 0; i < albums.length; i++) {
        var album = albums[i];
        var name = album.name;
        appendToCloud(name, ulalbums);
    }
    
    container.append("<ul id='sub-tag-cloud-tracks' class='subcloud flex-item'>");
    var ultracks = $("#sub-tag-cloud-tracks");
    for (var i = 0; i < tracks.length; i++) {
        var track = tracks[i];
        appendToCloud(track.name, ultracks);
    }
    
    console.log("Subvis done.");
    
    $("#sec_sub_vis").toggle(true);
}

function GetTimelineData(artistsByBin, tagsPerBin, binType) {
    var dataByTag = [];
    var dataByBin = [];
    var dataByTagMapped = {};
    
    var bins = Object.keys(tagsPerBin).sort(sortBins(binType));
    
    var makeDate = function(bin) {
        if (binType === binTypeYears)
            return bin + "-01";
        return bin;
    }
    
    var getOrCreateTagItem = function (tagname) {
        if (!dataByTagMapped[tagname]) {
            var dt = {};
            dt.name = tagname;
            dt.bins = [];
            for (var i = 0; i < bins.length; i++) {
                dt.bins[i] = {};
                dt.bins[i].name = tagname;
                dt.bins[i].bin = bins[i];
                dt.bins[i].date = makeDate(bins[i]);
                dt.bins[i].count = 0;
                dt.bins[i].relativecount = 0;
                dt.bins[i].artists = [];
            }
            dataByTagMapped[tagname] = dt;
            dataByTag.push(dt);
        }
        return dataByTagMapped[tagname];
    };
    
    var bin;
    for (var i = 0; i < bins.length; i++) {
        bin = bins[i];
        var dy = {};
        dy.bin = bin;
        dy.date = makeDate(bin);
        dy.tags = {};
        dy.tagsscaled = {};
        dy.maxcount = 0;
        var counts = getTagCounts(tagsPerBin[bin], artistsByBin[bin]);
        var tagcounts = counts.counts;
        var artistsByTag = counts.artists;
        var tagcounttotal = counts.total;
        var sortedNames = getSortedTagNames(tagcounts, 500);
        for (var j = 0; j < sortedNames.length; j++) {
            var tagname = sortedNames[j];
            var dt = getOrCreateTagItem(tagname);
            var count = tagcounts[tagname];
            dt.bins[i].count = count;
            dt.bins[i].artists = artistsByTag[tagname].sort(function (a, b) {
                return b.weight - a.weight;
            });
            dy.tags[tagname] = count;
            if (count > dy.maxcount)
                dy.maxcount = count;
        }
        for (var j = 0; j < sortedNames.length; j++) {
            var tagname = sortedNames[j];
            var dt = getOrCreateTagItem(tagname);
            var count = tagcounts[tagname];
            var relativecount = parseFloat(count) / dy.maxcount * 100;
            dt.bins[i].relativecount = relativecount;
            dt.bins[i].value = relativecount;
            dy.tagsscaled[tagname] = relativecount;
        }
        dataByBin.push(dy);
    }
    
    var lastbin = bins.length -1;
    dataByTag = dataByTag.sort(function (a,b) {
        var valA = a[lastbin] ? a[lastbin].count : 0;
        var valB = b[lastbin] ? b[lastbin].count : 0;
        return valB - valA;
    });
    
    console.log("timeline data:");
    console.log(dataByTag);
    console.log(dataByBin);
    return { byBin : dataByBin, byTag: dataByTag };
}

function getTagCounts(tagsByArtist, artists) {
    var tagcounts = {};
    var artistsByTag = {};
    var tagcounttotal = 0;
    
    var artistID;
    var tag;
    var tagname;
    var artisttaglist;
    for (var i = 0; i < artists.length; i++) {
        artistID = getArtistID(artists[i]);
        if (!tagsByArtist[artistID])
            continue;
        artisttaglist = tagsByArtist[artistID].toptags.tag;
        for (var j = 0; j < artisttaglist.length; j++) {
            tag = artisttaglist[j];
            tagname = cleanupTagName(tag.name);
            if (!filterTagName(tagname)) {
                recordFilteredTag(tagname);
                continue;
            }
			tagname = combineTagName(tagname, tagcounts);            
            if (!tagcounts[tagname]) {
                tagcounts[tagname] = 0;
            }
            var playcount = artists[i].totalplaycount ? artists[i].totalplaycount : artists[i].playcount;
            var tagcount = parseInt(tag.count);
            var artistweight = playcount * tagcount;
            tagcounts[tagname] += artistweight;
            tagcounttotal += artistweight;
            
            if (!artistsByTag[tagname])
                artistsByTag[tagname] = [];
            if (artistsByTag[tagname].indexOf(artists[i].name) < 0)
                artistsByTag[tagname].push({
                name: artists[i].name,
                totalplaycount: artists[i].totalplaycount,
                tagcount: tag.count,
                weight: artistweight,
            });
        }
    }
    
    return { counts: tagcounts, artists: artistsByTag, total: tagcounttotal };
}

function getSortedTagNames(tagcounts, maxTags) {
    var names = Object.keys(tagcounts);
    names.sort(function (a, b) {
        return tagcounts[b] - tagcounts[a];
    });
    return names.slice(0, maxTags);
}

function cleanupTagName(name) {
    return name.toLowerCase().replace(/-/g, " ");
}

function combineTagName(name, counts) {
	var stripName = function (s) {
		return cleanupTagName(s).replace(/ /g, "");
	};
	var stripped1 = stripName(name);
	var bestMatch = name;
	var bestMatchCounts = 0;
	for (var n in counts) {
		if (n == name) continue;
		var stripped2 = stripName(n);
		if (stripped1 == stripped2) {
			if (counts[n] > bestMatchCounts) {
				bestMatch = n;
				bestMatchCounts = counts[n];
			}
		}
	}
	return bestMatch;
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
    "finnish", "finland", "swedish", "japanese", "japan", "american", "scandinavian", "suomi", "france", "brazilian", "brazil", "irish", "german", "uk", "brasil", "usa", "french", "australian", "italian", "norwegian", "norway", "sweden", "british", "africa", "afrika", "arabic", "asian", "polish", "russian", "canadian", "latin", "deutsch", "spanish", "korean", "english", "dutch", "icelandic", "indian"
];

var nondescriptivetags = [
    "seen live", "favourites", "favourite", "favourite songs", "good", "awesome", "love", "loved", "beautiful", "albums i own", "under 2000 listeners", "sexy", "live", "heard on pandora", "love at first listen", "spotify"
]
