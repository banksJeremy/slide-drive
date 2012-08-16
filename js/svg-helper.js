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

    var bbox = this._getProportionalBBoxOf( el ),
        marker;

    console.log("PARENT", el.parentNode.nodeName)

    if ( el.parentNode.nodeName.match( /^a$/i ) ) {
      marker = document.createElement( 'a' );
      marker.href = el.parentNode.getAttributeNS( NS_XLINK, "href" );
      marker.style.borderBottom = "1px solid black";
      marker.style.cursor = "pointer";
    } else {
      marker = document.createElement( "span" );
    }

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

  var i, l, e, viewPort;
  for ( i = 0, l = childEls.length; i < l; ++i ) {
    for ( viewPort = childEls[ i ].viewportElement; viewPort; viewPort = viewPort.viewportElement ) {
      if ( !viewPort.querySelector( ".SVGHelper-viewportLocator" ) ) {
        var filler = document.createElementNS( NS_SVG, "rect" );
        filler.setAttribute( "class", "SVGHelper-viewportLocator" );
        filler.setAttribute( "x", 0 );
        filler.setAttribute( "y", 0 );
        filler.setAttribute( "width", "100%" );
        filler.setAttribute( "height", "100%" );
        filler.setAttribute( "fill", "none" );
        filler.setAttribute( "stroke", "none" );
        viewPort.appendChild( filler );
      } else {
        break;
      }
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
  this._removeInvisibleChildrenAndCheckIfVisible( this.svgEl );
  return this;
};

// Removes invisible elements in the subtree rooted at the specified element.
// If any children are hidden, returns false. If any are visible and have
// visibility="visible", return true. Otherwise they inherit their visibility,
// return null.
SVGHelper.prototype._removeInvisibleChildrenAndCheckIfVisible = function( fromEl ) {
  if ( fromEl.nodeType !== Node.ELEMENT_NODE ) {
    return true;
  }

  var anyVisible = null;

  if ( fromEl.getAttribute( "display" ) === "none" ) {
    anyVisible = false;
  } else if ( fromEl.getAttribute( "visibility" ) === "visible" ) {
    anyVisible = true;
  }

  var i, l, children = [].slice.apply( fromEl.childNodes ), child, childVisible;
  for ( i = 0, l = children.length; i < l; ++i ) {
    child = children[ i ];
    childVisible = this._removeInvisibleChildrenAndCheckIfVisible( child );
    if ( childVisible === true ) {
      if ( anyVisible === null ) {
        anyVisible = true;
      }
    } else if ( childVisible === false ) {
      fromEl.removeChild( child );
    }
  }
  if ( anyVisible === null && fromEl.getAttribute( "visibility" ) === "hidden" ) {
    anyVisible = false;
  }

  return anyVisible;
}

// Specifies which SVG features require workarounds in the current browser.
SVGHelper._requiredWorkarounds = {};

var tmp = document.createElement( "div" )
tmp.innerHTML = "<svg><image xlink:href=\"about:blank\"></image></svg>";

SVGHelper._requiredWorkarounds.xlinkAttrSerialization = !/xlink:href/.test( tmp.innerHTML );

SVGHelper._requiredWorkarounds.textSelection = /Gecko[\/]/.test( navigator.userAgent );

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
fontManager._reload = function( styleEl ) {
  this._reloadCalled = true;

  styleEl = styleEl || document.getElementById( "SVGHelper-fontManager-style" );

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

    data.unicodeGlyphs[ glyphEl.getAttribute( "unicode" ) ] = glyphData;
  }

  return this;
};

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