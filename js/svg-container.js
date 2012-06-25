(function() {
"use strict";

var NS_SVG = "http://www.w3.org/2000/svg",
    NS_XLINK = "http://www.w3.org/1999/xlink";

window.SVGContainer = SVGContainer;

function SVGContainer( rootEl ) {
  if ( !(this instanceof SVGContainer) ) {
    return new SVGContainer( rootEl );
  }

  if ( !(rootEl && rootEl.nodeType === Node.ELEMENT_NODE && rootEl.nodeName.toLowerCase() === "svg") ) {
    throw new Error( "SVGContainer must wrap an embedded SVG element." );
  }

  this.rootEl = rootEl;

  if ( rootEl.parentNode && rootEl.parentNode.classList.contains( "SVGContainer" ) ) {
    this.containerEl = rootEl.parentNode;
  } else {
    this.containerEl = makeContainer( rootEl );
  }

  return this;
}

function makeContainer( el ) {
  // Returns a <div> wrapping the target element, causing it to scale
  // to match the container's width at a fixed aspect ratio. The container
  // may be used to position elements relative to the SVG.

  var container = document.createElement( "div" ),
      canvasForScale = document.createElement( "canvas" ),
      imageForScale = document.createElement( "img" ),
      parentNode = el.parentNode;

  container.classList.add( "SVGContainer" );
  container.style.position = "relative";

  el.style.position = "absolute";
  el.style.top = 0;
  el.style.bottom = 0;
  el.style.left = 0;
  el.style.right = 0;
  el.style.width = "100%";
  el.style.height = "100%";

  var viewBoxWidth = el.viewBox.baseVal.width,
      viewBoxHeight = el.viewBox.baseVal.height,
      viewBoxDimensionsGCD = gcd(viewBoxHeight, viewBoxWidth);

  canvasForScale.width = viewBoxWidth / viewBoxDimensionsGCD;
  canvasForScale.height = viewBoxHeight / viewBoxDimensionsGCD;

  imageForScale.classList.add( "SVGContainer-scaler" );
  imageForScale.src = canvasForScale.toDataURL();
  imageForScale.style.width = "100%";
  imageForScale.style.height = "auto";
  imageForScale.style.maxHeight = "none";
  imageForScale.style.minHeight = "none";
  imageForScale.style.maxWidth = "none";
  imageForScale.style.maxHeight = "none";
  imageForScale.style.display = "block";

  if ( parentNode ) {
    parentNode.replaceChild( container, el );
  }

  container.appendChild( el );
  container.appendChild( imageForScale );

  return container;
}

SVGContainer.prototype.scaleTo = function( measure ) {
  var scaler = this.containerEl.querySelector( ".SVGContainer-scaler" );

  if ( measure === "width" ) {
    scaler.style.height = "auto";
    scaler.style.width = "100%";
  } else if ( measure === "height" ) {  
    scaler.style.height = "100%";
    scaler.style.width = "auto";
  } else {
    throw new Error( "scaleTo option must be \"height\" or \"width\"." )
  }

  return this;
}

SVGContainer.prototype.padTextViewports = function() {
  // We rely on elements' .getBBox() to determine the location and dimension of elements, but
  // if the element doesn't fill its available space the results won't be accurate. This method
  // creates an invisible rect to fill the dimensions of each element that is a .viewportElement
  // (directly on indirectly) of any <text> element.

  var viewPorts = [];

  var i, l, e, selection = this.rootEl.querySelectorAll( "text" ), parentView;
  for ( i = 0, l = selection.length; i < l; ++i ) {
    for ( parentView = selection[ i ].viewportElement; parentView; parentView = parentView.viewportElement ) {
      if ( viewPorts.indexOf( parentView ) === -1 ) {
        viewPorts.push( parentView );
      }
    }
  }

  for ( i = 0, l = viewPorts.length; i < l; ++i ) {
    e = viewPorts[ i ]

    if ( !e.querySelector( ".SVGContainer-bbox-fill" ) ) {
      var filler = document.createElementNS( NS_SVG, "rect" );
      filler.setAttribute( "class", "SVGContainer-bbox-fill" );
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

SVGContainer.prototype.reparse = function() {
  this.rootEl = reparseAndReplace( this.rootEl );
  return this;
};

function reparseAndReplace( el ) {
  // Converts an element to HTML and back, replacing its former self in the DOM.

  var tmpContainer = document.createElement( "div" ),
      tmpSource,
      parent = el.parentNode

  parent && parent.replaceChild( tmpContainer, el );
  tmpContainer.appendChild( el );

  tmpSource = tmpContainer.innerHTML;
  tmpContainer.innerHTML = "";
  tmpContainer.innerHTML = tmpSource;

  var replacement = tmpContainer.firstChild;
  parent && tmpContainer.parentNode.replaceChild( replacement, tmpContainer );

  return replacement;
};

SVGContainer.prototype.getRelativeBBoxOf = function( child ) {
  // Get the bounding box of a child element within the SVG rootEl.
  // Values are represented as fractions of width/height.

  var bBoxes = [],
      current = child,
      nativeBBox;

  while ( true ) {
    nativeBBox = (current.querySelector( ".SVGContainer-bbox-fill" ) || current).getBBox();

    if ( current !== this.rootEl ) {
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
      throw new Error( "Element must be descendant of SVG rootEl." )
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

SVGContainer.prototype.joinAdjacentTextEls = function() {
  // Converts adjacent <text> elements to <tspan>s within a parent <text>.
  // Attributes are copied to the new <tspan>, valid or not. 

  var i, j, k, l, m, n;

  var textEls = [].slice.call( this.rootEl.querySelectorAll( "text" ) );

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

        oldEl !== firstEl && oldEl.parentNode.removeChild( oldEl );

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
}

var tmp = document.createElement( "div" )
tmp.innerHTML = "<svg><image xlink:href=\"about:blank\"></image></svg>";
var xlinkAttrsNeedFixing = !/xlink:href/.test( tmp.innerHTML );

SVGContainer.prototype.fixXlinkAttrs = function() {
  // Modifies some elements to accomidate a bug in Chrome that causes
  // xlink:href attributes to be serialized incorrectly.
  // TODO: Currently only looks at <images>; this should be made more general.

  if ( !xlinkAttrsNeedFixing ) {
    return this;
  }

  var images = this.rootEl.querySelectorAll( "image" ), i, l, el;

  for( i = 0, l = images.length; i < l; i++ ) {
    el = images[ i ];

    var href = el.getAttribute( "xlink:href" );

    el.removeAttribute( "xlink:href" );
    el.setAttribute( "xlink:href", href );
    el.setAttributeNS( "http://www.w3.org/1999/xlink", "href", href );
  }

  return this;
};

SVGContainer.prototype.overlaySelectableSpans = function() {
  // SVG text isn't selectable in Firefox, so in Firefox we'll overlay
  // selectable invisible <span>s to handle it.

  /*
    Hey, fool: tspan doesn't have a getBBox!
  */

  if ( !/Gecko[\/]/.test( navigator.userAgent ) ) {
    return this;
  }

  var markerContainer = document.createElement( "div" );
  markerContainer.classList.add( "SVGContainer-selectable-text-container" );
  markerContainer.classList.add( "data-butter-exclude" );

  var i, l, e, selection = this.rootEl.querySelectorAll( "text" );
  for ( i = 0, l = selection.length; i < l; ++i ) {
    e = selection[ i ];

    var bbox = this.getRelativeBBoxOf( e );

    var marker = document.createElement( "span" );
    marker.textContent = e.textContent;

    marker.classList.add( "SVGContainer-selectable-text-overlay" );
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
    marker.style.fontSize = bbox.height * this.containerEl.clientHeight + "px";

    markerContainer.appendChild( marker );
  }

  this.containerEl.appendChild( markerContainer );

  return this;
}

function gcd( a, b ) {
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
    if ( a == 0 ) {
      return b;
    }
    b %= a;
    if (b == 0) {
      return a;
    }
  }
}

}());
