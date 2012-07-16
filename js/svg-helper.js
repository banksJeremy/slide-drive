(function(){
"use strict";

var NS_SVG = "http://www.w3.org/2000/svg",
    NS_XLINK = "http://www.w3.org/1999/xlink";

window.SVGHelper = SVGHelper;

// Creates an SVGHelper object wrapping the specified root SVG element.
// This doesn't modify the element (though methods do). "new" is optional.
function SVGHelper( svgEl ) {
  if ( !(this instanceof SVGHelper) ) {
    return new SVGHelper( svgEl );
  }

  this.svgEl = svgEl;

  return this;
}

// Returns a <div> wrapping the <svg> causing it to scale to width while
// maintaing its aspect ratio. Elements may be appended and positioned relative
// to this <div> to control their position relative to the SVG. The <div> will
// not be created again if it already exists, so this may be used to obtain a
// reference to it.
SVGHelper.prototype.wrapper = function() {
  if (this.svgEl.parentNode && this.svgEl.parentNode.classList.contains( "SVGHelper-wrapper" )) {
    return this.svgEl.parentNode;
  }

  var wrapper = document.createElement( "div" ),
      canvasForScale = document.createElement( "canvas" ),
      imageForScale = document.createElement( "img" ),
      parentNode = this.svgEl.parentNode;

  wrapper.classList.add( "SVGHelper-wrapper" );
  wrapper.style.position = "relative";

  this.svgEl.style.position = "absolute";
  this.svgEl.style.top = 0;
  this.svgEl.style.bottom = 0;
  this.svgEl.style.left = 0;
  this.svgEl.style.right = 0;
  this.svgEl.style.width = "100%";
  this.svgEl.style.height = "100%";

  var viewBoxWidth = this.svgEl.viewBox.baseVal.width,
      viewBoxHeight = this.svgEl.viewBox.baseVal.height,
      viewBoxDimensionsGCD = _gcd( viewBoxHeight, viewBoxWidth );

  canvasForScale.width = viewBoxWidth / viewBoxDimensionsGCD;
  canvasForScale.height = viewBoxHeight / viewBoxDimensionsGCD;

  imageForScale.classList.add( "SVGHelper-scaler" );
  imageForScale.src = canvasForScale.toDataURL();
  imageForScale.style.width = "100%";
  imageForScale.style.height = "auto";
  imageForScale.style.maxHeight = "none";
  imageForScale.style.minHeight = "none";
  imageForScale.style.maxWidth = "none";
  imageForScale.style.maxHeight = "none";
  imageForScale.style.margin = 0;
  imageForScale.style.display = "block";

  if ( parentNode ) {
    parentNode.replaceChild( wrapper, this.svgEl );
  }

  wrapper.appendChild( this.svgEl );
  wrapper.appendChild( imageForScale );

  return wrapper;
};

// Loads every <font> from the SVG into fontManager, re-writes the fonts to the
// document and removes the <font> elements from the SVG.
SVGHelper.prototype.extractFonts = function() {
  var fontEls = this.svgEl.querySelectorAll( "font" ),
      fontEl, i, l;
  for ( i = 0, l = fontEls.length; i < l; ++i ) {
    fontEl = fontEls[ i ];
    SVGHelper.fontManager.loadFont( fontEl );
    fontEl.parentNode.removeChild( fontEl );
  }
  if ( i ) {
    SVGHelper.fontManager.writeFonts();
  }

  return this;
};

// Converts adjacent <text> elements into <tspan> elements, moving over the
// properties and contents and grouping them into a parent <text> element.
// Note that not all <text> attributes are valid on <tspans>, particularly
// in SVG Tiny, but they will be copied indiscriminately.
SVGHelper.prototype.joinAdjacentTextEls = function() {
  var i, j, k, l, m, n;

  var textEls = [].slice.call( this.svgEl.querySelectorAll( "text" ) );

  for ( i = 0, l = textEls.length; i < l; ++i ) {
    var firstEl = textEls[ i ],
        consecutiveEls = [ firstEl ],
        latestEl = firstEl;

    while ( i + 1 < l && latestEl.nextElementSibling === textEls[ i + 1 ] ) {
      latestEl = textEls[ i + 1 ];
      consecutiveEls.push( latestEl );

      ++i;
    }

    if ( consecutiveEls.length > 1 ) {
      var newContainer = document.createElementNS( NS_SVG, "text" );

      newContainer.setAttribute( "x", firstEl.getAttribute( "x" ) );
      newContainer.setAttribute( "y", firstEl.getAttribute( "y" ) );

      for ( j = 0, m = consecutiveEls.length; j < m; ++j ) {
        var oldEl = consecutiveEls[ j ],
            oldElAttributes = oldEl.attributes,
            oldElChildren = [].slice.call( oldEl.childNodes ),
            newEl = document.createElementNS( NS_SVG, "tspan" );

        newContainer.appendChild( newEl );

        if ( oldEl !== firstEl ) {
          oldEl.parentNode.removeChild( oldEl );
        }

        for ( k = 0, n = oldElAttributes.length; k < n; ++k ) {
          var oldElAttr = oldElAttributes.item( k );
          newEl.setAttribute( oldElAttr.nodeName, oldElAttr.nodeValue );
        }

        for ( k = 0, n = oldElChildren.length; k < n; ++k ) {
          newEl.appendChild( oldElChildren[ k ] );
        }
      }

      firstEl.parentNode.replaceChild( newContainer, firstEl );
    }
  }

  return this;
};

// Adjusts the dimensions and margin of the SVG's wrapper to fit inside the
// specified container (defaulting to the parentNode of the wrapper). The
// wrapper will be centered and maintain the its aspect ratio.
SVGHelper.prototype.fitIn = function( container_ ) {
  var wrapper = this.wrapper(),
      container = container_ || wrapper.parentNode,
      availableHeight = container.clientHeight,
      availableWidth = container.clientWidth,
      // aspectRatio assumes that the width and height are defined in the same units
      aspectRatio = this.svgEl.viewBox.baseVal.width / this.svgEl.viewBox.baseVal.height,
      widthFitToHeight = availableHeight * aspectRatio,
      heightFitToWidth = availableWidth / aspectRatio;

  if ( widthFitToHeight <= availableWidth ) {
    // Scale to height
    var extraWidth = availableWidth - widthFitToHeight;

    wrapper.style.width = widthFitToHeight + "px";

    wrapper.style.marginLeft = "auto";
    wrapper.style.marginRight = "auto";
    wrapper.style.marginTop = 0;
  } else {
    // Scale to width
    var extraHeight = availableHeight - heightFitToWidth;

    wrapper.style.width = "100%";
    
    wrapper.style.marginLeft = 0;
    wrapper.style.marginRight = 0;
    wrapper.style.marginTop = extraHeight / 2;
  }

  return this;
};

// If neccessary, works around a bug where attribute namespace prefixes are
// ommited if they're of a different namespace than their parent element.
SVGHelper.prototype.fixXlinkAttrSerialization = function() {
  if ( !SVGHelper._requiredWorkarounds.xlinkAttrSerialization ) {
    return this;
  }

  // TODO: Currently only looks at <image>s, ignoring <a> and others.

  var images = this.svgEl.querySelectorAll( "image" ), i, l, el;

  for( i = 0, l = images.length; i < l; i++ ) {
    el = images[ i ];

    var href = el.getAttribute( "xlink:href" );

    el.removeAttribute( "xlink:href" );
    el.setAttribute( "xlink:href", href );
  }

  return this;
};

// If neccessary, works around a lack of text selection support by overlaying
// <span>s with copies of all text on top of the SVG.
SVGHelper.prototype.fixTextSelection = function() {
  if ( !SVGHelper._requiredWorkarounds.textSelection ) {
    return this;
  }

  var markerContainer = document.createElement( "div" ),
      wrapper = this.wrapper();
  markerContainer.classList.add( "SVGHelper-selectable-text-container" );
  markerContainer.classList.add( "data-butter-exclude" );

  var i, l, el, textEls = this.svgEl.querySelectorAll( "text" );

  this._addViewportLocatorsFor( textEls );
  
  for ( i = 0, l = textEls.length; i < l; ++i ) {
    el = textEls[ i ];

    var bbox = this._getProportionalBBoxOf( el );

    var marker = document.createElement( "span" );
    marker.textContent = el.textContent;

    marker.classList.add( "SVGHelper-selectable-text-overlay" );
    marker.style.position = "absolute";
    marker.style.top = bbox.y * 100 + "%";
    marker.style.left = bbox.x * 100 + "%";
    marker.style.width = bbox.width ? (bbox.width * 100 + "%") : "1px";
    marker.style.height = bbox.height ? (bbox.height * 100 + "%") : "1px";
    marker.style.cursor = "text";
    marker.style.overflow = "hidden";
    marker.style.textAlign = "center";
    marker.style.whiteSpace = "pre";
    marker.style.color = "rgba(0,0,0,0.0)";
    marker.zIndex = 10;

    marker.style.opacity = 0.5;

    // We size our characters based on the current pixel size of the originals.
    // If the SVG is resized, this may become inaccurate. If this value is too
    // small then the entire character may not be appear to be selected. If it
    // is too large then the selection may exclude the last character.
    marker.style.fontSize = bbox.height * wrapper.clientHeight + "px";

    markerContainer.appendChild( marker );
  }

  this._removeViewportLocators();

  wrapper.appendChild( markerContainer );

  return this;
};

// Returns a bounding box { x, y, width, height } of a target element.
// Dimensions are represented as fractions of the SVG's total dimensions.
// This will almost certainly produce inaccurate results unless viewport
//  locators have been added for childEl, see ._addViewportLocatorsFor().
SVGHelper.prototype._getProportionalBBoxOf = function( childEl ) {
  // Get the bounding box of a child element within the SVG svgEl.
  // Values are represented as fractions of width/height.

  var bBoxes = [],
      current = childEl,
      nativeBBox;

  while ( true ) {
    nativeBBox = (current.querySelector( ".SVGHelper-viewportLocator" ) || current).getBBox();

    if ( current !== this.svgEl ) {
      bBoxes.push({
        x: nativeBBox.x,
        y: nativeBBox.y,
        innerWidth: nativeBBox.width,
        outerWidth: nativeBBox.width,
        innerHeight: nativeBBox.height,
        outerHeight: nativeBBox.height
      });
    } else {
      bBoxes.push({
        x: 0,
        y: 0,
        innerWidth: nativeBBox.width,
        outerWidth: 1,
        innerHeight: nativeBBox.height,
        outerHeight: 1
      });

      break;
    }

    current = current.viewportElement;

    if ( !current ) {
      throw new Error( "Element must be descendant of SVG svgEl." );
    }
  }

  bBoxes.reverse();

  var i, l,
      totalBox = {
        x: 0,
        y: 0,
        outerWidth: 1,
        innerWidth: 1,
        outerHeight: 1,
        innerHeight: 1
      };

  for ( i = 0, l = bBoxes.length; i < l; i++ ) {
    current = bBoxes[ i ];

    totalBox.x += totalBox.outerWidth * current.x / totalBox.innerWidth;
    totalBox.y += totalBox.outerHeight * current.y / totalBox.innerHeight;

    totalBox.outerWidth *= current.outerWidth / totalBox.innerWidth;
    totalBox.outerHeight *= current.outerHeight / totalBox.innerHeight;

    totalBox.innerWidth = current.innerWidth;
    totalBox.innerHeight = current.innerHeight;
  }

  return {
    x: totalBox.x,
    y: totalBox.y,
    width: totalBox.outerWidth,
    height: totalBox.outerHeight
  };
};

// Adds the viewport locators (currently invisible <rects> padded to the
// dimensions of each viewport ancestor but this may change) required to
// ._getProportionalBBoxOf() of all childEls. Calling this multiple times
// has no effect.
SVGHelper.prototype._addViewportLocatorsFor = function( childEls ) {
  var viewPorts = [];

  // TODO: be more efficient. Stop searching up as soon as there's an
  // already-locatored viewPort, etc.

  var i, l, e, parentView;
  for ( i = 0, l = childEls.length; i < l; ++i ) {
    for ( parentView = childEls[ i ].viewportElement; parentView; parentView = parentView.viewportElement ) {
      if ( viewPorts.indexOf( parentView ) === -1 ) {
        viewPorts.push( parentView );
      }
    }
  }

  for ( i = 0, l = viewPorts.length; i < l; ++i ) {
    e = viewPorts[ i ];

    if ( !e.querySelector( ".SVGHelper-viewportLocator" ) ) {
      var filler = document.createElementNS( NS_SVG, "rect" );
      filler.setAttribute( "class", "SVGHelper-viewportLocator" );
      filler.setAttribute( "x", 0 );
      filler.setAttribute( "y", 0 );
      filler.setAttribute( "width", "100%" );
      filler.setAttribute( "height", "100%" );
      filler.setAttribute( "fill", "none" );
      filler.setAttribute( "stroke", "none" );
      e.appendChild( filler );
    }
  }

  return this;
};

// Removes all viewport locators from the SVG.
SVGHelper.prototype._removeViewportLocators = function() {
  var locatorEls = this.svgEl.querySelectorAll( ".SVGHelper-viewportLocator" ), i, l, el;
  for ( i = 0, l = locatorEls.length; i < l; ++i ) {
    el = locatorEls[ i ];
    el.parentNode.removeChild( el );
  }

  return this;
};

// Reduces the size of the SVG without affecting functionality.
// (Removes empty <def></def> elements and any whitespace nodes that aren't
// inside of <text>.)
SVGHelper.prototype.minify = function( fromEl ) {
  fromEl = fromEl || this.svgEl;

  var children = [].slice.apply( fromEl.childNodes ), i, l;
  for ( i = 0, l = children.length; i < l; ++i )  {
    this.minify( children[ i ] );
  }

  if ( fromEl.nodeType === Node.TEXT_NODE
       && fromEl.parentNode.nodeName !== "tspan"
       && fromEl.parentNode.nodeName !== "text" ) {
    if ( /^\s*$/.test( fromEl.textContent ) ) {
      fromEl.parentNode.removeChild( fromEl );
    }
  } else if ( fromEl.nodeType === Node.ELEMENT_NODE ) {
    if ( fromEl.nodeName === "defs" && fromEl.childNodes.length === 0 ) {
      fromEl.parentNode.removeChild( fromEl );
    }
  }

  return this;
};

// Removes from the SVG any elements with .style.visibility = "hidden" or
// "collapse" and no children with .style.visibility = "visible", and any
// elements .style.display = "none". This does not respect stylesheets!
// We do not use .getComputedStyle because the SVG is not required to be
// attached to the document.
SVGHelper.prototype.removeInvisibles = function() {
  

  return this;
};

// Removes invisible elements in the subtree rooted at the specified element.
// Returns true of the specified element should itself be removed, false if it
// should not.
SVGHelper.prototype._removeInvisiblesFrom = function( fromEl ) {
  throw "TODO";
//  The element itself deserves to be invisible only if it has display none, or if it has
//  visibility hidden and none of its children have visiblity shown. So I guess this
// function can return three states
  
//  "visible", "invisible", "specifically-invisible"
}

// Specifies which SVG features require workarounds in the current browser.
SVGHelper._requiredWorkarounds = {};

var tmp = document.createElement( "div" )
tmp.innerHTML = "<svg><image xlink:href=\"about:blank\"></image></svg>";

SVGHelper._requiredWorkarounds.xlinkAttrSerialization = !/xlink:href/.test( tmp.innerHTML );

SVGHelper._requiredWorkarounds.textSelection = !/Gecko[\/]/.test( navigator.userAgent );

/*
http://www.w3.org/TR/SVG/fonts.html
http://www.w3.org/TR/CSS2/fonts.html
http://stackoverflow.com/q/11438150
*/

// See .loadFont() and .writeFonts().
var fontManager = SVGHelper.fontManager = {
  _fontData: [],

  // Note that this flag only indicates that ._reload() has been called,
  // not that its execution is completed. (This is probably only relevant
  // to its use in .writeFonts().)
  _reloadCalled: false
};

document.addEventListener( "DOMContentLoaded", function() {
  if ( !fontManager._reloadCalled ) {
    fontManager._reload();
  }
});

// If loaded fonts have previously been written to a <style>, this loads
// them back into fontManager. This is intended to be used for restoring the
// manager's internal state when a page it has affected is saved and reloaded.
// This will be run automatically once, either after the DOM has loaded or
// after .writeFonts() is first called. It may be called again safely, but
// that shouldn't be neccessary.
fontManager._reload = function() {
  this._reloadCalled = true;

  var styleEl = document.getElementById( "SVGHelper-fontManager-style" );

  if ( !styleEl ) {
    return this;
  }

  var b64DataPattern = /"data:image\/svg\+xml;base64,([^"]*)"/g, m;
  while ( m = b64DataPattern.exec( styleEl.textContent ) ) {
    console.log( "SVGHelper.fontManager - reloading font..." );

    var b64Fonts = m[ 1 ], decodedFontSource, tmpEl, fontEl;

    decodedFontSource = atob(b64Fonts);
    decodedFontSource = decodedFontSource.replace(/^<\?xml[^\?]*\?>/i, "");
    tmpEl = document.createElement( "div" );
    tmpEl.innerHTML = decodedFontSource;

    fontEl = tmpEl.querySelector( "font" );
    this.loadFont( fontEl );
  }
  
  return this;
};

// Loads the data from an SVG <font> element. If you want to use a
// different font-family than the <font-face> specifies you can specify
// fontFamily as a string or a function.
fontManager.loadFont = function( fontEl, fontFamily ) {
  var fontFaceEl = fontEl.querySelector( "font-face" );

  if ( !fontFaceEl ) {
    throw new Error( "No <font-face /> found in font." );
  }

  var description = this._makeFontDescription( fontFaceEl );
  
  if ( typeof fontFamily === "function" ) {
    description.fontFamily = String( fontFamily( description.fontFamilyFilter ) );
  } else if ( fontFamily ) {
    description.fontFamily = String( fontFamily );
  }

  var data = this._getGylphs( description ),
      newMissingGlyph = fontEl.querySelector( "missing-glyph" );
  
  if ( newMissingGlyph ) {
    data.missingGlyph = {
      horizAdvX: newMissingGlyph.getAttribute("horiz-adv-x"),
      d: newMissingGlyph.getAttribute( "d" )
    };
  }

  var newUnicodeGlyphs = fontEl.querySelectorAll( "glyph" );
  for ( var i = 0; i < newUnicodeGlyphs.length; i++ ) {
    var glyphEl = newUnicodeGlyphs[ i ],
        glyphData = {
      horizAdvX: glyphEl.getAttribute( "horiz-adv-x" ),
      d: glyphEl.getAttribute( "d" ) || ""
    };
    
    glyphData.outlineDetails = this._parseSVGPath( glyphData );
    console.log( glyphData.outlineDetails );

    data.unicodeGlyphs[ glyphEl.getAttribute( "unicode" ) ] = glyphData;
  }

  return this;
};


var SVG_FONT_COMMAND_PARAMETER_COUNT = {
  m: 2, // moveto, relative
  M: 2, // moveto, absolute
  z: 0, // closepath
  Z: 0, // closepath
  l: 2, // lineto, relative
  L: 2, // lineto, absolute
  h: 1, // horizontal lineto, relative
  H: 1, // horizontal lineto, absolute
  v: 1, // vertical lineto, relative
  V: 1, // vertical lineto, absolute
  c: 6, // cubic bézier curveto, relative
  C: 6, // cubic bézier curveto, absolute
  s: 4, // smooth cubic bézier curveto, relative
  S: 4, // smooth cubic bézier curveto, absolute
  q: 4, // quadratic bézier curveto, relative
  Q: 4, // quadratic bézier curveto, absolute
  t: 2, // smooth quadratic bézier curveto, relative
  T: 2, // smooth quadratic bézier curveto, absolute
  a: 8, // elliptical arc, relative
  A: 8  // elliptical arc, absolute
}

// Converts an SVG path string into a series of command objects
// including their arguments. This doesn't interpret them at all.
fontManager._parseSVGPath = function( glyph ) {
  var pathDataPieces = glyph.d.match( /[a-z]|[\+\-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:e[\+\-][0-9]+)?/ig ),
      pathCommands = [],

      i, l, piece,
      j, requiredArgs, args, arg,
      command = null;

  if ( pathDataPieces ) {
    pathDataPieces = pathDataPieces.map(function( piece ) {
      if ( piece.match( /^[a-z]$/i ) ) {
        return piece; // command
      } else {
        return +piece; // argument, numeric
      }
    });
  } else {
    return [];
  }

  for ( i = 0, l = pathDataPieces.length; i < l; ) {
    piece = pathDataPieces[ i ];
    
    if ( typeof piece === "string" ) {
      command = piece;
      i++;
    } else {
      if ( !command ) {
        throw new Error( "Argument " + piece + " specified before any command." );
      }
    }
    
    requiredArgs = SVG_FONT_COMMAND_PARAMETER_COUNT[ command ];
    
    if ( requiredArgs == null ) {
      throw new Error( "Unknown command in path: " + command )
    }

    args = [];

    for ( j = 0; j < requiredArgs; ++j ) {
      arg = pathDataPieces[ i ];
      if ( typeof arg !== "number" ) {
        throw new Error( "Expected argument for command " + command + ", got " + arg + "." );
      }
      i++;
      
      args.push( arg );
    }

    pathCommands.push({
      comand: command,
      args: args
    });
  }

  return pathCommands;
}

// Adds or updates a <style> element with declarations for the loaded fonts.
// If this element is found with teh document is loaded then fontManager will
// load its initial ._fontData from it.
fontManager.writeFonts = function() {
  // We don't want to overwrite fonts in the DOM without loading them first.
  if ( !fontManager._reloadCalled ) {
    fontManager._reload();
  }

  var styleEl = document.getElementById( "SVGHelper-fontManager-style" );

  if ( !styleEl ) {
    styleEl = document.createElement( "style" );
    styleEl.id = "SVGHelper-fontManager-style";
    document.head.appendChild( styleEl );
  }
  
  var this_ = this;
  styleEl.textContent = this._fontData.map(function( description_glyphs ) {
    var description = description_glyphs[0], glyphs = description_glyphs[1];
    
    var svgFont = this_.makeSVG( description, glyphs ),
        svgFontDataUri = "data:image/svg+xml;base64," + btoa( svgFont );

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
      "       url(\"" + svgFontDataUri + "\") format(\"svg\");\n" +
    " }";
  }).join( "\n" );

  return this;
};

// Generates an SVG font file for the given font, as a binary string.
fontManager.makeSVG = function( description, glyphs ) {
  var svgEl = document.createElement( "svg" ),
      defsEl = document.createElementNS( NS_SVG, "defs" ),
      fontEl = document.createElementNS( NS_SVG, "font" ),
      fontFaceEl = document.createElementNS( NS_SVG, "font-face" );

  svgEl.style.display = "none";
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

  if ( glyphs.missingGlyph ) {
    var missingGlyphEl = document.createElementNS( NS_SVG, "missing-glyph" );
    missingGlyphEl.setAttribute( "d", glyphs.missingGlyph.d );
    missingGlyphEl.setAttribute( "horiz-adv-x", glyphs.missingGlyph.horizAdvX );

    fontEl.appendChild( missingGlyphEl );
  }

  for ( var unicode in glyphs.unicodeGlyphs ) {
    var newGlyphEl = document.createElementNS( NS_SVG, "glyph" );

    newGlyphEl.setAttribute( "unicode", unicode );
    newGlyphEl.setAttribute( "d", glyphs.unicodeGlyphs[ unicode ].d );
    newGlyphEl.setAttribute( "horiz-adv-x", glyphs.unicodeGlyphs[ unicode ].horizAdvX );

    fontEl.appendChild( newGlyphEl );
  }
  
  var body = svgEl.innerHTML,
      utf8Body = unescape( encodeURIComponent( body ) ),
      s = '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg">' + utf8Body + '</svg>';

  return s;
};

// Generates a WOFF font file for the given font, as a binary string.
fontManager._makeWOFF = function( description, glyphs ) {
  var fontTables = [];
  
  fontTables.push({
    tag: "cmap",
    data: [
      encodeUint16( 0 ), // cmap table version
      encodeUint16( 1 ), // number of encoding tables
      
      encodeUint16( 3 ), // platform ID for windows
      encodeUint16( 0 ), // encoding ID for "Byte encoding table"
      encodeUint32( 10 ), // offset to subtable of data (below) from start of table
      
      encodeUint16( 0 ), // format 0
      encodeUint16( 262 ), // length of this subtable
      encodeUint16( 0 ), // languge, N/A
      BYTE_VALUES
    ].join( "" );
  });

  fontTables.push({
    tag: "head",
    data: [
      "\x00\x01\x00\x00", // table version number
      "\x00\x00\x00\x00", // font revision,
      "????",             // Checksum adjustment
      "\x5F\x0F\x3C\xF5", // magic number
      "\x00\x00\x00\x00", // flags
      encodeUint16( description.unitsPerEm ),
      encodeUint32( 0 ), // creation date
      encodeUint32( 0 ), // modified date
      encodeUint16( TODO ), // x-min for all glyphs (signed!)
      encodeUint16( TODO ), // y-min for all glyphs (signed!)
      encodeUint16( TODO ), // x-max for all glyphs (signed!)
      encodeUint16( TODO ), // y-min for all glyphs (signed!)
      encodeUint16(
        description.fontWeight === "bold" ? 1 << 15 : 0
      + description.fontStyle === "italic" ? 1 << 14 : 0
      + description.fontStretch === "condensed" ? 1 << 10 : 0
      ), // font style flags
      encodeUint16( 0 ), // minimum size in pixels
      encodeUint16( 2 ), // fontDirectionHint deprecated, (signed!)
      encodeUint16( 0 ), // indexToLocFormat
      encodeUint16( 0 ) // reserved
    ].join( "" );
  });

  fontTables.push({
    tag: "OS/2",
    data: [
      encodeUint16( 4 ), // version
      encodeUint16( TODO ), // average width of non-zero-width glyphs
      encodeUint16( description.fontWeight === "bold" ? 700 : 500 ),
      encodeUint16( description.fontStretch === "condensed" ? 3 : 5 ),
      encodeUint16( 0 ), // licensing restrictions
      encodeUint16( 0 ), // ySubscriptXSize - we're neglecting this
      encodeUint16( 0 ), // ySubscriptYSize - we're neglecting this
      encodeUint16( 0 ), // ySubscriptXOffset - we're neglecting this
      encodeUint16( 0 ), // ySubscriptYOffset - we're neglecting this
      encodeUint16( 0 ), // ySuperscriptXSize - we're neglecting this
      encodeUint16( 0 ), // ySuperscriptYSize - we're neglecting this
      encodeUint16( 0 ), // ySuperscriptXOffset - we're neglecting this
      encodeUint16( 0 ), // ySuperscriptYOffset - we're neglecting this
      encodeUint16( 0 ), // yStrikeoutSize - we're neglecting this
      encodeUint16( 0 ), // yStrikeoutPosition - we're neglecting this
      encodeUint16( 0 ), // no font family class
      "\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00", // Panose classification
      "\xC0\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00", // supported chars
      "\x00\x00\x00\x00", // vendor ID
      encodeUint16(
        description.fontWeight === "bold" ? 1 << 15 : 0
      + description.fontStyle === "italic" ? 1 << 10 : 0
      ),
      encodeUint16( 0 ), // first supported char
      encodeUint16( 255 ), // last supported char
      encodeUint16( 0 ),
      encodeUint16( 0 ),
      encodeUint16( 0 ),
      encodeUint16( 0 ),
      "\xC0\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00",
      encodeUint16( 0 ),
      encodeUint16( 0 ),
      encodeUint16( 0 ),
      encodeUint16( 0 ),
      encodeUint16( 0 )
    ].join( "" )
  })


  return _makeWoffFromFontTables( fontTables );
}

/*
http://people.mozilla.com/~jkew/woff/woff-spec-latest.html
https://developer.apple.com/fonts/tools/tooldir/TrueEdit/Documentation/TE/TE1sfnt.html
http://www.microsoft.com/typography/otspec/otff.htm

For now, we're just going to use the "byte encoding table", which can only encode
characters up to 0xFF. After this is working we may implement something more flexible.

*/

fontManager._makeWoffFromFontTables = function( fontTables ) {
  var dataPieces = [], // all pieces of the file excluding headers
      i, l;



  var totalLength = 44; // header size
  for ( i = 0, l = dataPieces.length; i < l; ++i ) {
    totalLength += dataPieces[ i ].length;
  }

  var headerPieces = [
    "wOFF",             // WOFF Signature
    "\x00\x01\x00\x00", // TrueType-flavoured
    encodeUint32( totalLength ),
    encodeUint16( fontTables.length ),
    "\x00\x00",         // Reserved
    "????",             // Total size needed for the uncompressed font data, including the sfnt header, directory, and tables.
    "\x00\x00",         // Major version
    "\x00\x00",         // Minor version
    "\x00\x00\x00\x00", // No metadata block
    "\x00\x00\x00\x00", // No metadata block
    "\x00\x00\x00\x00", // No metadata block
    "\x00\x00\x00\x00", // No private data block
    "\x00\x00\x00\x00"  // No private data block
  ],
      pieces = headerPieces.concat( dataPieces ),
      s = pieces.join( "" ); 

  return s;
}

// Retreives the font glyphs given a font's description.
fontManager._getGylphs = function( description ) {
  for (var i = 0 ; i < this._fontData.length; i++) {
    if ( 0 === this._compareFontDescriptions( this._fontData[ i ][ 0 ], description ) ) {
      return this._fontData[ i ][ 1 ];
    }
  }
  var fontGlyphs = {
    missingGlyph: null,
    unicodeGlyphs: {}
  };
  this._fontData.push([ description, fontGlyphs ]);
  this._fontData.sort( this._compareFontDescriptions );
  return fontGlyphs;
};

// Makes a font description object from a <font-face> element.
fontManager._makeFontDescription = function( fontFaceEl ) {
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
};

// Compares font descriptions, for equality or sorting. (Though sort order isn't significant.)
fontManager._compareFontDescriptions = function( a, b ) {
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
};

var BYTE_VALUES = "\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0A\x0B\x0C\x0D\x0E\x0F" +
                  "\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1A\x1B\x1C\x1D\x1E\x1F" +
                  "\x20\x21\x22\x23\x24\x25\x26\x27\x28\x29\x2A\x2B\x2C\x2D\x2E\x2F" +
                  "\x30\x31\x32\x33\x34\x35\x36\x37\x38\x39\x3A\x3B\x3C\x3D\x3E\x3F" +
                  "\x40\x41\x42\x43\x44\x45\x46\x47\x48\x49\x4A\x4B\x4C\x4D\x4E\x4F" +
                  "\x50\x51\x52\x53\x54\x55\x56\x57\x58\x59\x5A\x5B\x5C\x5D\x5E\x5F" +
                  "\x60\x61\x62\x63\x64\x65\x66\x67\x68\x69\x6A\x6B\x6C\x6D\x6E\x6F" +
                  "\x70\x71\x72\x73\x74\x75\x76\x77\x78\x79\x7A\x7B\x7C\x7D\x7E\x7F" +
                  "\x80\x81\x82\x83\x84\x85\x86\x87\x88\x89\x8A\x8B\x8C\x8D\x8E\x8F" +
                  "\x90\x91\x92\x93\x94\x95\x96\x97\x98\x99\x9A\x9B\x9C\x9D\x9E\x9F" +
                  "\xA0\xA1\xA2\xA3\xA4\xA5\xA6\xA7\xA8\xA9\xAA\xAB\xAC\xAD\xAE\xAF" +
                  "\xB0\xB1\xB2\xB3\xB4\xB5\xB6\xB7\xB8\xB9\xBA\xBB\xBC\xBD\xBE\xBF" +
                  "\xC0\xC1\xC2\xC3\xC4\xC5\xC6\xC7\xC8\xC9\xCA\xCB\xCC\xCD\xCE\xCF" +
                  "\xD0\xD1\xD2\xD3\xD4\xD5\xD6\xD7\xD8\xD9\xDA\xDB\xDC\xDD\xDE\xDF" +
                  "\xE0\xE1\xE2\xE3\xE4\xE5\xE6\xE7\xE8\xE9\xEA\xEB\xEC\xED\xEE\xEF" +
                  "\xF0\xF1\xF2\xF3\xF4\xF5\xF6\xF7\xF8\xF9\xFA\xFB\xFC\xFD\xFE\xFF";

// Encodes a number as a big-endian 16-bit unsigned integer.
var encodeUint16 = function( n ) {
  return String.fromCharCode(
    (n >> 8) & 255,
    n & 255
  );
};

// Encodes a number as a big-endian 32-bit unsigned integer.
var encodeUint32 = function( n ) {
  return String.fromCharCode(
    (n >> 24) & 255,
    (n >> 16) & 255,
    (n >> 8) & 255,
    n & 255
  );
};

// Returns the greatest common denominator of two integers.
var _gcd = function( a, b ) {
  if ( a < 0 ) {
    a = -a;
  }
  if ( b < 0 ) {
    b = -b;
  }
  if ( b > a ) {
    var temp = a;
    a = b;
    b = temp;
  }
  while ( true ) {
    a %= b;
    if ( a === 0 ) {
      return b;
    }
    b %= a;
    if (b === 0) {
      return a;
    }
  }
};

}());