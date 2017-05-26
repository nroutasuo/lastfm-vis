/**
* General functions for the page UI.
* Last.fm tools by Noora Routasuo
* Built with D3.js (https://d3js.org/)
* Last.fm (https://www.last.fm/api)
*/

var vistype;
var vistypeCloud = "cloud";
var vistypeTimeline = "timeline";
var vistypeAlbumChart = "albums";

var username = "";
var artistlimit = 10;
var period = "overall";
var filterCountries = false;
var filterDecades = false;

var working = false;

$(document).ready(function () {
    // set blink
    window.setInterval(blink, 500);
    
    // set initial tab
    $("#sec_tabs .tabbutton")[0].click();
    
    // enable starting visualization with enter key
    enableKeyboardStart($("#username"));
    enableKeyboardStart($("#artistcount"));
});

function selectVis(evt, vis) {
    var tablinks = $(".tabbutton").removeClass("active");
    evt.target.className += " active";

    vistype = vis;
    
    var textVisIntro = "";
    var textVisDetails = "";
    var showInputNumArtists = false;
    var showInputArtistPeriod = false;
    var showInputTagFilters = false;
    switch (vis) {
        
        case vistypeTimeline:
            textVisIntro = "A timeline of tags based on artist tags on a user's weekly charts.";
            textVisDetails = "Tag count is based on the number of times it's listed on artists on the user's weekly charts on the given time period. The chart is scaled relative to total counts for that period. Obvious tags like 'seen live' are filtered out and some common spelling variations ('post rock' and 'post-rock') are combined."
            showInputNumArtists = true;
            showInputTagFilters = true;
            break;
        
        case vistypeCloud:
            textVisIntro = "A simple tag cloud based on a user's top artists.";
            textVisDetails = "Tag count is based on the number of times it's listed for top artists. Obvious tags like 'seen live' are filtered out and some common spelling variations ('post rock' and 'post-rock') are combined."
            showInputNumArtists = true;
            showInputArtistPeriod = true;
            showInputTagFilters = true;
            break;
        
        case vistypeAlbumChart:
            textVisIntro = "Do you ever miss the news that an artist you like has released a new album? Or perhaps you've overlooked an older one. This handly little app will list your top artists, all of their albums, and highlight the ones you haven't listened to.";
            textVisDetails = "Albums are filtered to avoid duplicates, special editions, demos, etc, etc, so it's possible some albums are missing. Then again, there probably are duplicates anyway. Release years are not very reliable.";
            showInputNumArtists = true;
            showInputArtistPeriod = true;
            break;
    }
    
    $("#visintro").text(textVisIntro);
    $("#visdetails").text(textVisDetails);
    
    fadeToggleIf($("#input_numartists"), showInputNumArtists);
    fadeToggleIf($("#input_artistperiod"), showInputArtistPeriod);
    fadeToggleIf($("#input_tagfilters"), showInputTagFilters);
}

function startVis() {
    clearVis();
    var selectionsOK = getSelections();
    if (!selectionsOK)
        return;
    
	// Load top artists
    working = true;
    showLoaded(0);
    
    if (vistype === vistypeCloud)
        makeCloud(username, artistlimit, period);
    else if(vistype === vistypeTimeline)
        makeTimeline(username, artistlimit);
    else if (vistype === vistypeAlbumChart)
        makeAlbumChart(username, artistlimit, period);
}

function cancelVis() {
    stopLoading('Cancelled.','');
    clearVis();
}

function clearVis() {
	showError("");
    $("#sec_vis").children().remove();
}

function getSelections() {
	username = $("#username").val();
    if (username.length < 1) {
        stopLoading("Enter a Last.fm username.", "");
        return false;
    }
    
    if ($("#artistcount").is(":visible")) {
        var count = Number($("#artistcount").val());
        if (count <= 0) {
            stopLoading("Enter a number of top artists to load.", "");
            return;
        }
        artistlimit = count;
    }
    
    period = $("#artistperiod").val();
    
    filterCountries = $("#filter-countries").is(':checked');
    filterDecades = $("#filter-decades").is(':checked');
    
    return true;
}

function stopLoading(info, error) {
    showInfo(info);
    showError(error);
    working = false;
}

function showError(msg) {
	if(msg.length > 0)
		$("#errormsg").text("Error: " + msg);
	else
		$("#errormsg").text("");
}

function showInfo(msg) {
	if(msg.length > 0)
		$("#infomsg").text(msg);
	else
		$("#infomsg").text("");
}

function showLoaded(percentage) {
    showInfo((percentage).toFixed(0) + "% loaded");
}

function blink() {
    var elm = document.getElementById('infomsg');
    if (working) {
        if (elm.style.color == 'rgb(30, 30, 30)')
            elm.style.color = 'rgb(140, 140, 140)';
        else
            elm.style.color = 'rgb(30, 30, 30)';
    } else {
        elm.style.color = 'rgb(30, 30, 30)';    	
    }
}

function fadeToggleIf(e, show) {
    var isVisible = $(e).is(":visible");
    if (isVisible == show)
        return;
    if (show)
        $(e).fadeIn(250);
    else
        $(e).fadeOut(250);
}

function enableKeyboardStart(input) {
    $(input).keypress(function(e) {
        var code = e.keyCode || e.which;
        if (code === 13) {
            fetchData();
        }
    });
}
