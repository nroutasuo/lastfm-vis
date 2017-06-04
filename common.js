
function getArtistID(artist) {
    if (artist.mbid)
        return artist.mbid;
    else
        return simplifyString(artist.name);
}

function getArtistNameID(artistname) {
    return "artist-" + simplifyString(artistname);
}

function simplifyString(s) {
    return s.toLowerCase().replace(/[ &\.\/\']/g, "");
}