
// LAST.FM STUFF

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