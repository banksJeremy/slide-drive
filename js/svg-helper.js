(function(){
"use strict";

/*
http://www.w3.org/TR/SVG/fonts.html#FontDescriptions
http://www.w3.org/TR/2008/REC-CSS2-20080411/fonts.html#font-descriptions
http://stackoverflow.com/questions/11438150/using-font-face-with-an-svg-font-embedded-in-the-current-html-page/

This is not a particularly geeral tool; it is suited to the SVG fonts generted by LibreOffice, which don't use all possible features..
*/

var NS_SVG = "http://www.w3.org/2000/svg"
var fonts = [];

if ( document.getElementById("SVGFontHelper-data") ) {
  fonts = JSON.parse( document.getElementById("SVGFontHelper-data").textContent );
}

// Adds or updates a <style> element with declarations for the loaded fonts, as well as
// a <script type="application/json"> containing the font data.
function writeStyle() {
  var styleEl = document.getElementById("SVGFontHelper-style"),
      scriptEl = document.getElementById("SVGFontHelper-data");

  if ( !styleEl ) {
    styleEl = document.createElement( "style" );
    styleEl.id = "SVGFontHelper-style";
    document.head.appendChild( styleEl );
  }

  if ( !scriptEl ) {
    scriptEl = document.createElement( "script" );
    scriptEl.type = "application/json";
    scriptEl.id = "SVGFontHelper-data";
    document.head.appendChild( scriptEl );
  }

  scriptEl.textContent = JSON.stringify( fonts, null, 2 );
  styleEl.textContent = fonts.map(function( description_data ) {
    var description = description_data[0], data = description_data[1];

    return "@font-face {\n" +
      "  font-family: \"" + description.fontFamily + "\";\n" +
      "  font-style: " + description.fontStyle + ";\n" +
      "  font-size: " + description.fontSize + ";\n" +
      "  font-variant: " + description.fontVariant + ";\n" +
      "  font-weight: " + description.fontWeight + ";\n" +
      "  font-stretch: " + description.fontStretch + ";\n" +
      "  units-per-em: " + description.unitsPerEm + ";\n" +
      (description.ascent ? "  ascent: " + description.ascent + ";\n" : "") +
      (description.descent ? "  descent: " + description.descent + ";\n" : "") +
      "  src: local(\"" + description.fontFamily + "\"),\n" +
      "       url(\"" + makeDataURIForFont( description, data ) + "\") format(\"svg\");\n" +
    " }";
  }).join("\n");
}

// Produces a base64-encoded data URI containing an SVG font with the given description and data.
function makeDataURIForFont( description, data ) {
  var svgEl = document.createElement( "svg" ),
      defsEl = document.createElementNS( NS_SVG, "defs" ),
      fontEl = document.createElementNS( NS_SVG, "font" ),
      fontFaceEl = document.createElementNS( NS_SVG, "font-face" );

  svgEl.appendChild( defsEl );
  defsEl.appendChild( fontEl );

  fontFaceEl.setAttribute( "font-family", description.fontFamily );
  fontFaceEl.setAttribute( "font-style", description.fontStyle );
  fontFaceEl.setAttribute( "font-size", description.fontSize );
  fontFaceEl.setAttribute( "font-variant", description.fontVariant );
  fontFaceEl.setAttribute( "font-weight", description.fontWeight );
  fontFaceEl.setAttribute( "font-stretch", description.fontStretch );
  fontFaceEl.setAttribute( "units-per-em", description.unitsPerEm );
  fontFaceEl.setAttribute( "ascent", description.ascent );
  fontFaceEl.setAttribute( "descent", description.descent );

  fontEl.appendChild( fontFaceEl );

  if ( data.missingGlyph ) {
    var missingGlyphEl = document.createElementNS( NS_SVG, "missing-glyph" );
    missingGlyphEl.setAttribute( "d", data.missingGlyph.d );
    missingGlyphEl.setAttribute( "horiz-adv-x", data.missingGlyph.horizAdvX );

    fontEl.appendChild( missingGlyphEl );
  }

  for ( var unicode in data.unicodeGlyphs ) {
    var newGlyphEl = document.createElementNS( NS_SVG, "glyph" );

    newGlyphEl.setAttribute( "unicode", unicode );
    newGlyphEl.setAttribute( "d", data.unicodeGlyphs[ unicode ].d );
    newGlyphEl.setAttribute( "horiz-adv-x", data.unicodeGlyphs[ unicode ].horizAdvX );

    fontEl.appendChild( newGlyphEl );
  }
  var body = svgEl.innerHTML
    // .replace(/><\/glyph>/g, "/>")
    // .replace(/><\/missing-glyph>/, "/>")
    // .replace(/><\/font-face>/, "/>");

  var utf8Body = unescape( encodeURIComponent( body ) );

  var s = '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg">' + utf8Body + '</svg>';
  document.body.appendChild(svgEl);
  return "data:image/svg+xml;base64," + btoa( s );
}

// Loads the data from an SVG <font> element.
function loadFont( fontEl ) {
  var fontFaceEl = fontEl.querySelector( "font-face" );

  if ( !fontFaceEl ) {
    throw new Error("No <font-face /> found in font.")
  }

  var description = makeFontDescription( fontFaceEl ),
      data = getFont( description );

  var newMissingGlyph = fontEl.querySelector( "missing-glyph" );
  if ( newMissingGlyph ) {
    data.missingGlyph = {
      horizAdvX: newMissingGlyph.getAttribute("horiz-adv-x"),
      d: newMissingGlyph.getAttribute("d")
    };
  }

  var newUnicodeGlyphs = fontEl.querySelectorAll( "glyph" );
  for ( var i = 0; i < newUnicodeGlyphs.length; i++ ) {
    var glyphEl = newUnicodeGlyphs[ i ];
    data.unicodeGlyphs[ glyphEl.getAttribute("unicode") ] = {
      horizAdvX: glyphEl.getAttribute( "horiz-adv-x" ),
      d: glyphEl.getAttribute( "d" )
    };
  }
}

// Retreives the font data (glyphs) given a font's description.
function getFont( description ) {
  for (var i = 0 ; i < fonts.length; i++) {
    if ( 0 === compareFontDescriptions( fonts[ i ][ 0 ], description ) ) {
      return fonts[ i ][ 1 ];
    }
  }
  var fontData = {
    missingGlyph: null,
    unicodeGlyphs: {}
  };
  fonts.push([ description, fontData ]);
  fonts.sort(compareFontDescriptions);
  return fontData;
}

// Makes a font description object from a <font-face> element.
function makeFontDescription( fontFaceEl ) {
  var description = {
    fontFamily: fontFaceEl.getAttribute( "font-family" ),
    fontStyle: fontFaceEl.getAttribute( "font-style" ) || "all",
    fontSize: fontFaceEl.getAttribute( "font-size" ) || "all",
    fontVariant: fontFaceEl.getAttribute( "font-variant" ) || "normal",
    fontWeight: fontFaceEl.getAttribute( "font-weight" ) || "normal",
    fontStretch: fontFaceEl.getAttribute( "font-stretch" ) || "all",
    unitsPerEm: fontFaceEl.getAttribute( "units-per-em" ) || "1000",
    ascent: fontFaceEl.getAttribute( "ascent" ) || "",
    descent: fontFaceEl.getAttribute( "descent" ) || ""
  };

  if ( !description.fontFamily ) {
    throw new Error("font-family not specified");
  }

  return description;
}

// Compares font descriptions, for equality or sorting. (Sort order isn't particularly significant at the moment.)
function compareFontDescriptions( a, b ) {
  if ( a.fontFamily < b.fontFamily ) return -1;
  if ( a.fontFamily > b.fontFamily ) return +1;
  if ( a.fontStyle < b.fontStyle ) return -1;
  if ( a.fontStyle > b.fontStyle ) return +1;
  if ( a.fontSize < b.fontSize ) return -1;
  if ( a.fontSize > b.fontSize ) return +1;
  if ( a.fontVariant < b.fontVariant ) return -1;
  if ( a.fontVariant > b.fontVariant ) return +1;
  if ( a.fontWeight < b.fontWeight ) return -1;
  if ( a.fontWeight > b.fontWeight ) return +1;
  if ( a.fontStretch < b.fontStretch ) return -1;
  if ( a.fontStretch > b.fontStretch ) return +1;
  if ( a.unitsPerEm < b.unitsPerEm ) return -1;
  if ( a.unitsPerEm > b.unitsPerEm ) return +1;
  if ( a.ascent < b.ascent ) return -1;
  if ( a.ascent > b.ascent ) return +1;
  if ( a.descent < b.descent ) return -1;
  if ( a.descent > b.descent ) return +1;
  return 0;
}

window.svgFontManager = {
  loadFont: loadFont,
  writeStyle: writeStyle
};

}());