/*
  A StyleMapper is initialized with a list describing which properties
  of which selectors should be copied to which properties of which
  selectors, and an element containing children that satisfy each of
  the original selectors.
*/

function StyleMapper( styleMap, sampleEl ) {
  this.styleMap = styleMap;
  this.sampleEl = sampleEl;
}

StyleMapper.prototype.update = function( styleId ) {
  var styleEl = document.getElementById( styleId );
  if ( !styleEl ) {
    styleEl = document.createElement( "style" );
    styleEl.id = styleId;
    document.head.appendChild( styleEl );
  }

  styleEl.textContent = "";
  var style = this._makeStyle();
  styleEl.textContent = style;
};

StyleMapper.prototype._makeStyle = function() {
  var i, l,
      sampleElContainer = document.createElement( "div" ),
      sourceSampleEl, sourceSampleStyle, samplePropertyValue,
      sourceSelector, targetSelector, sourceProperty, targetProperty,
      stylePieces = [];

  sampleElContainer.appendChild( this.sampleEl );
  document.body.appendChild( sampleElContainer );
  
  for ( sourceSelector in this.styleMap ) {
    if ( !this.styleMap.hasOwnProperty( sourceSelector ) ) continue;
    
    sourceSampleEl = sampleElContainer.querySelector( sourceSelector );
    if ( !sourceSampleEl ) {
      throw new Error( "No sample element matching selector: " + sourceSelector );
    }
    sourceSampleStyle = getComputedStyle( sourceSampleEl );
    
    stylePieces.push( "/* styles from " + sourceSelector + " */" );
    
    for ( targetSelector in this.styleMap[ sourceSelector ] ) {
      if ( !this.styleMap[ sourceSelector ].hasOwnProperty( targetSelector ) ) continue;
      
      stylePieces.push( targetSelector + " {" )
      
      for ( sourceProperty in this.styleMap[ sourceSelector ][ targetSelector ] ) {
        if ( !this.styleMap[ sourceSelector ][ targetSelector ].hasOwnProperty( sourceProperty ) ) continue;
        
        targetProperty = this.styleMap[ sourceSelector ][ targetSelector ][ sourceProperty ];
        samplePropertyValue = sourceSampleStyle[ sourceProperty ];
        
        if ( samplePropertyValue ) {
          stylePieces.push( "  " + targetProperty + ": " + samplePropertyValue + ";" );
        } else {
          console.warn( "No value for property " + sourceProperty + " of " + sourceSelector + " to copy to " + targetProperty + " of " + targetSelector + "." );
        }
      }
      
      stylePieces.push( "}" );
    }
    
    stylePieces.push( "" );
  }
  
  document.body.removeChild( sampleElContainer );
  
  return stylePieces.join( "\n" );
};

var deckSvgStyleMapper = new StyleMapper({
  ".deck-container": {
    ".deck-container .slide svg": {
      "background-color": "fill"
    },
    ".deck-container .slide svg text": {
      "color": "fill"
    }
  },
  ".deck-container .slide h1": {
    ".deck-container .slide svg .com\\.sun\\.star\\.presentation\\.TitleTextShape text": {
      "color": "fill",
      "font-style": "font-style"
    }
  }
},
$("<div class=deck-container>").append(
  $("<div class=slide>").append(
    $("<h1>")
  )
)[0]);

window.addEventListener( "load", function() {
  console.log( "Initializing style map." );
  deckSvgStyleMapper.update( "deck-svg-mapped-styles" );
}, false);
