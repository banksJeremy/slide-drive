(function() {
"use strict";
window.Butter || Popcorn, jQuery, $;

var NS_SVG = "http://www.w3.org/2000/svg",
    NS_XLINK = "http://www.w3.org/1999/xlink";

var SD = window.__sd = {
  editing: false,
  printableElement: null,
  showingPrintable: null,
  popcorn: null,
  anchorTargetId: null,
  deckInitialized: false
};

addEventListener( "DOMContentLoaded", function() { SD.init(); } );

SD.init = function() {
  console.log( "Initializing Slide-Drive." );

  if ( window.location.hash > "#" ) {
    SD.anchorTargetId = window.location.hash.substr( 1 );
  }

  if ( SD.editing ) {
    console.log( "Loading butter." );
    Butter({
      config: "/external_configs/butter/config.json",
      ready: SD._init_withButterIfEditing
    });
  } else {
    console.log( "Not loading butter." )
    SD._init_withButterIfEditing();
  }
}

// Creates and returns a new debounced version of the passed nullary
// function that will postpone its execution until after interval ms
// have elapsed since the last time it was invoked.
SD.debounce = function( f, interval ) {
  function debounced() {
    if ( debounced._pendingTimeoutId ) {
      clearTimeout( debounced._pendingTimeoutId );
    }
    debounced._pendingTimeoutId = setTimeout( fire, interval );
  };
  function fire() {
    debounced._pendingTimeoutId = null;
    f();
  };
  debounced.interval = interval;
  debounced.f = f;
  debounced._pendingTimeoutId = null;
  if (f.name) {
    debounced.name = f.name + "_debounced";
  }
  return debounced;
}

SD._init_withButterIfEditing = function( butter ) {
  if ( SD.editing ) { 
    console.log( "Butter loaded" );
    SD.butter = butter;
  }

  console.log( "Initializing mediaelementplayer" );
  $( "audio" ).mediaelementplayer({ success: beginPolling });

  function beginPolling( mediaElement, domObject ) {
    console.log( "mediaelementplayer initializing, waiting for SD.popcorn.readyState() >= 2." );
    SD.popcorn = Popcorn( mediaElement, { frameAnimation: false } );
    poll();
  }

  function poll() {
    if ( SD.popcorn.readyState() < 2 ) {
      setTimeout( poll, 250 );
      return;
    }

    console.log( "SD.popcorn.readyState() >= 2" );

    if ( SD.editing ) {
      console.log( "waiting for SD.butter.currentMedia.onReady()." );
      SD.butter.currentMedia.onReady(function() {
        SD._init_afterMediaReady();
      });
    } else {
      SD._init_afterMediaReady();
    }
  }
}

SD._init_afterMediaReady = function() {
  console.log( "Media ready." );

  // Parse slide data into live Popcorn events or Butter timeline events.
  var butterTrack,
      addEvent = SD.editing ? function ( options ) { butterTrack.addTrackEvent({ type: "slidedrive", popcornOptions: options }); }
                            : function ( options ) { SD.popcorn.slidedrive( options ); },
      slidesEls = document.querySelectorAll( ".slide" ),
      slideEvents = [],
      currentOptions, previousOptions = null;

  if ( SD.editing ) {
    SD.butter.page.listen( "getHTML", SD.onButterPageGetHTML);

    // Bind file drop handling to each Butter track.
    SD.butter.currentMedia.listen( "trackadded" , function( e ) {
      var track = e.data;
      track.view.listen( "filesdropped", function( e ) {
        SD.onButterTrackFilesDropped( e.data.files, e.data.track, e.data.start );
      });
    });

    butterTrack = SD.butter.currentMedia.addTrack( "Slides" );
  }

  for ( var i = 0; i < slidesEls.length; ++i ) {
    currentOptions = SD.SlideButterOptions( slidesEls[ i ] );

    if ( previousOptions ) {
      previousOptions.end = currentOptions.start - 0.001;
    }

    slideEvents.push( currentOptions );

    previousOptions = currentOptions;
  }

  previousOptions.end = SD.popcorn.duration();

  for ( var i = 0; i < slideEvents.length; ++i ) {
    addEvent( slideEvents[ i ] );
  }

  SD._init_events();

  SD.initDeck();
  
  SD.fixSvgs();

  SD.svgsRequireRescaling();

  // The SD.popcorn event for slide 0 isn't fired properly if the video starts inside it, so
  // we need to move out of it and back to it.
  $.deck("next");
  $.deck("prev");

  [].forEach.call( document.querySelectorAll( ".slide video" ), SD.syncVideo );

  if ( location.search.match( /(^\?|&)autoplay=1(&|$)/ ) ) {
    SD.popcorn.play();
  }

  window._slideDriveReady = true; // required for tests
}

// Initializes or re-initializes the deck. Used in initialization and after changes.
SD.initDeck = function() {
  if ( SD.deckInitialized ) {
    // Re-initializing the Deck will add any new slides, but it causes the
    // presentation to be reset to the first slide, so we preserve its state.
    console.log("Re-initializing Deck.js.");

    var currentTime = SD.popcorn.currentTime(),
        currentSlide$ = $.deck( "getSlide" ),
        currentSlideOptions = currentSlide$ && SD.SlideButterOptions( currentSlide$[ 0 ] );

    $.deck( ".slide" );

    if ( currentSlide$ && currentTime >= currentSlideOptions.start && currentTime <= currentSlideOptions.end ) {
      $.deck( "go", currentSlideOptions.slideId );
    } else {
      // A new slide might have been placed at the current time, we need to make
      // sure we jump back to into it to be sure it's activated.
      SD.popcorn.currentTime( 0 );
    }

    SD.popcorn.currentTime( currentTime );
  } else {
    console.log("Initializing Deck.js.");
    
    SD.deckInitialized = true;
    $.deck( ".slide" );

    if ( SD.anchorTargetId != null ) {
      console.log("Navigating to permalink target #" + SD.anchorTargetId);
      
      $.deck( "go", SD.anchorTargetId );
    }
  }
  
  SD.initTimelineTargets();
}

SD.initTimelineTargets = function() {

};

SD._init_events = function() {
  if ( SD.editing ) {
    SD.initEditorEvents();
  } else {
    console.log( "Activating our keyboard shortcuts." );

    document.addEventListener( "keydown", SD.onKeyDown, false);
  }

  $(document).bind( "deck.change", SD.onDeckChange);

  window.addEventListener("resize", SD.svgsRequireRescaling );
};

SD.onKeyDown = function( e ) {
  if ( e.keyCode === 80 ) {
    if ( !SD.popcorn.paused() ) {
      SD.popcorn.pause();
    } else {
      SD.popcorn.play();
    }
  } else if( e.keyCode === 84 ) {
    if( !printableElement ) {
      printableElement = SD.initPrintableElement();
    }
    if( !showingPrintable ) {
      printableElement.style.display = "";
      document.getElementById( "main" ).style.display = "none";
      SD.svgsRequireRescaling();
    } else {
      printableElement.style.display = "none";
      document.getElementById( "main" ).style.display = "";
      SD.svgsRequireRescaling();
    }
    showingPrintable = !showingPrintable;
  }
};

SD.onDeckChange = function( event, from, to ) {
  if ( from === to ) {
    return;
  }

  var container = document.querySelector( ".deck-container" ),
      slides = document.querySelectorAll( ".slide" ),
      slide = slides[ to ],
      oldSlide = slides[ from ],
      outerSlide = slide,
      parentSlides = $( slide ).parents( ".slide" ),
      i, l;

  // Size should be based on height of the current master slide, not sub-slide.
  if (parentSlides.length) {
    outerSlide = parentSlides[ parentSlides.length - 1 ];
  }

  if( outerSlide.offsetHeight > container.offsetHeight) {
    container.style.overflowY = "auto";
  } else {
    container.style.overflow = "hidden";
  }

  var toSlide = SD.SlideButterOptions( slide ),
      fromSlide = SD.SlideButterOptions( slide ),
      currentTime = SD.popcorn.currentTime();

  document.getElementById( "slideshow-transcript" ).innerHTML = toSlide.transcriptSource;

  var outsideOfTarget = currentTime < toSlide.start || currentTime >= toSlide.end;
  if ( outsideOfTarget ) {
    console.log("Updating currentTime to match slide: ", toSlide.start, toSlide.slideId)
    SD.popcorn.currentTime( toSlide.start );
  }
};

// Provides a properties object for a Popcorn slidedrive track event
// which persists its value in the slide element.
SD.SlideButterOptions = function( elOrId ) {
  var _el;

  if ( typeof elOrId === "string" ) {
    _el = document.getElementById( elOrId );

    if ( _el == null ) {
      throw new Error( "There is no element with ID " + elOrId );
    }
  } else {
    _el = elOrId;

    if ( !(_el && "nodeType" in _el) ) {
      throw new Error( "SlideButterOptions argument must be a DOM node or ID thereof.\nIt was " + _el );
    }
  }

  var existingInstance =  $( _el ).data( "slidedrive.butteroptions" );

  if ( existingInstance ) {
    return existingInstance;
  }

  if ( !(this instanceof SD.SlideButterOptions) ) {
    return new SD.SlideButterOptions( _el );
  }
  
  this.startHandlers = [];
  this.endHandlers = [];
  $( _el ).data( "slidedrive.butteroptions", this );

  Object.defineProperties( this, {
    start: {
      enumerable: true,
      get: function() {
        return +_el.getAttribute( "data-popcorn-slideshow" ) || 0;
      },
      set: function( start ) {
        _el.setAttribute( "data-popcorn-slideshow", start );

        if ( !_el.parentNode ) {
          throw new Error("Moving detached element E = ", window.E = _el);
        }

        var successor = null,
            parent = _el.parentNode,
            siblings = parent.childNodes,
            i, sib, sibStartAttr, sibStart;

        // Loop backwards through siblings to find the new new location for this element.
        for ( i = siblings.length - 1; i >= 0; --i ) {
          sib = siblings[ i ];
          if ( !("getAttribute" in sib) ) {
            continue; // not an element
          }

          sibStartAttr = sib.getAttribute( "data-popcorn-slideshow" );

          if ( sibStartAttr ) {
            sibStart = +sibStartAttr;

            if ( sibStart >= start ) {
              successor = sib;
            }
          }
        }

        if ( successor !== _el ) {
          parent.removeChild( _el );

          if ( successor == null ) {
            parent.appendChild( _el );
          } else {
            parent.insertBefore( _el, successor );
          }

          SD.initDeck();
        } else {
          SD.initTimelineTargets();
        }
      }
    },

    slideId: {
      enumerable: true,
      get: function() {
        return SD.getIdForEl( _el );
      }
    },

    transcriptSource: {
      enumerable: true,
      get: function() {
        var transcriptEl = _el.querySelector(".transcript");

        if ( transcriptEl == null ) {
          return "";
        } else {
          if ( transcriptEl.innerHTML != null ) {
            return transcriptEl.innerHTML;
          } else {
            return transcriptEl.textContent;
          }
        }
      },
      set: function ( transcriptSource ) {
        var transcriptEl = _el.querySelector(".transcript");

        if ( transcriptEl == null ) {
          if ( _el.innerHTML != null ) {
            transcriptEl = document.createElement( "div" );
            transcriptEl.innerHTML = transcriptSource;
          } else {
            transcriptEl = document.createElement( "text" );
            transcriptEl.textContent = transcriptSource;
            transcriptEl.setAttribute( "visibility", "hidden" );
          }
          transcriptEl.setAttribute( "class", "transcript" );
          _el.insertBefore( transcriptEl, _el.firstChild );
        } else {
          if ( transcriptEl.innerHTML != null ) {
            transcriptEl.innerHTML = transcriptSource;
          } else {
            transcriptEl.textContent = transcriptSource;
          }
        }
      }
    }
  });

  this.end = this.start + 1;
};
SD.SlideButterOptions.prototype = {
  _onstart: function() {
    for ( var i = 0; i < this.startHandlers.length; ++i ) {
      if ( this.startHandlers[ i ].apply( this ) === false ) {
        return false;
      }
    }
  },

  _onend: function() {
    for ( var i = 0; i < this.startHandlers.length; ++i ) {
      if ( this.endHandlers[ i ].apply( this ) === false ) {
        return false;
      }
    }
  }
};

// Scale all SVGs 200ms after the last call
SD.svgsRequireRescaling = SD.debounce(function() {
  var svgs = document.querySelectorAll("#main svg"), i, l;
  for ( i = 0, l = svgs.length; i < l; ++i ) {
    SVGHelper( svgs[ i ] ).fitIn( document.querySelector( ".deck-container" ) );
  }

  var svgs = document.querySelectorAll(".printable-container svg"), i, l;
  for ( i = 0, l = svgs.length; i < l; ++i ) {
    SVGHelper( svgs[ i ] ).fitIn( $(svgs[i]).closest(".printable-slide")[0] );
  }
}, 200);

// Returns the "id" attribute value for a given element.
// If the element does not have an "id" attribute defined, it is given a random one based on its text content.-
SD.getIdForEl = function( el ) {
  if ( el.hasAttribute( "id" ) ) {
    return el.getAttribute( "id" );
  } else {
    var id = (el.textContent.replace( /[^a-z0-9]/gi, '' ).substring( 0, 8 )
              .toLowerCase() || "s") + "-" + ( Math.random() * (1 << 30) | 0 ).toString( 36 );
    el.setAttribute( "id", id );
    return id;
  }
}

SD.initPrintableElement = function() {
  var body = document.getElementById( "printable" ),
      bodyChildren = document.getElementById( "main" ).getElementsByTagName( "section" );

  for( var i = 0, l = bodyChildren.length; i < l; i++ ) {
    var slideContainer = document.createElement("div"),
        slide = document.createElement( "div" ),
        transcript = document.createElement( "div" ),
        gotoLink = document.createElement( "a" );

    slideContainer.className = "printable-container";

    slide.className = "printable-slide";
    transcript.className = "printable-transcript";
    gotoLink.href = "#" + bodyChildren[ i ].getAttribute( "id" );
    gotoLink.textContent = "Go to Slide";

    gotoLink.className = "print-nav-link";

    gotoLink.addEventListener( "click", function() {
      document.getElementById( "printable" ).style.display = "none";
      document.getElementById( "main" ).style.display = "";
      showingPrintable = false;
    }, false );

    slide.appendChild( bodyChildren[ i ].cloneNode(true) );
    slide.appendChild( gotoLink );

    slide.children[ 0 ].className = "slide deck-child-current";

    if( slide.children[ 0 ] && slide.children[ 0 ].children[ 0 ] ) {

      var trans = slide.children[ 0 ].querySelectorAll(".transcript"),
          slides = slide.children[ 0 ].querySelectorAll(".slide"),
          innerTrans = "";

      if( slides.length > 0 ) {
        for( var j = 0, k = slides.length; j < k; j++ ) {
          slides[ j ].className = "slide deck-current";
        }
      }
      if( trans.length > 0 ) {
        for( var a = 0, s = trans.length; a < s; a++ ) {
         innerTrans += trans[ a ].innerHTML + "\n";
        }
        transcript.innerHTML = innerTrans;
      }
    }

    slideContainer.appendChild( slide );
    slideContainer.appendChild( transcript );
    body.appendChild( slideContainer );
    (function( sl, tr ) {
      function resize() {
        var rect = sl.getBoundingClientRect();
        if( rect.height > 0 ) {
          tr.style.height = rect.height + "px";
        } else {
          setTimeout( resize, 100 );
        }
      }
      resize();
    })( slide, transcript );
  }

  return document.getElementById("printable");
}

SD.initTimelineTargets = SD.debounce(function() {
  console.log( "Setting slide indicators on timeline." );

  var parent = document.querySelector( ".mejs-time-total" ),
      container = document.createElement( "div" ),
      slidesFromDeck = $.deck( "getSlides" ),
      slides = slidesFromDeck ? slidesFromDeck.map( function( $el ) { return $el[ 0 ]; } ) : [],
      existingIndicators = document.querySelector( ".timeline-indicators" ),
      totalTime = SD.popcorn.duration(),
      i, l, slide, slideOptions, markEl, startTime;

  if ( existingIndicators ) {
    existingIndicators.parentNode.removeChild( existingIndicators );
  }

  parent.style.position = "relative";
  container.classList.add( "timeline-indicators" );

  for ( i = 0, l = slides.length; i < l; ++i ) {
    slide = slides[ i ];
    startTime = SD.SlideButterOptions( slide ).start;

    if ( startTime === 0 ) {
      continue;
    }

    markEl = document.createElement( "div" );
    markEl.style.position = "absolute";
    markEl.style.top = 0;
    markEl.style.height = "10px";
    markEl.style.width = "1px";
    markEl.style.background = "black";
    markEl.style.left = (startTime / totalTime) * 100 + "%";

    container.appendChild( markEl );
  }
  parent.appendChild( container );
}, 250 );

SD.fixSvgs = SD.debounce(function() {
  var svgs = [].slice.call( document.querySelectorAll( "svg" ) ), i, l;
  $(".com\\.sun\\.star\\.drawing\\.LineShape mask").remove();
  
  for ( i = 0, l = svgs.length; i < l; ++i ) {
    SVGHelper( svgs[ i ] )
      .fixTextSelection() // fix text selection in Firefox
      .joinAdjacentTextEls() // fix text selection in Chrome
      .fixXlinkAttrSerialization(); // fix serialization in Chrome
  }
}, 250 );

SD.syncVideo = function( el ) {
  console.log("Setting up synced video.")

  var slideOptions = SD.SlideButterOptions( $( el ).closest( ".slide" )[ 0 ] ),
      elPopcorn = Popcorn( el ),
      wasPlaying = false;

  el.controls = false;
  SD.popcorn.on( "volumechange", onVolumeChange );

  slideOptions.startHandlers.push(function() {
    elPopcorn.currentTime( SD.popcorn.currentTime() - slideOptions.start );
    elPopcorn.play();
    SD.popcorn.on( "play", onPlay );
    SD.popcorn.on( "pause", onPause );
    SD.popcorn.on( "seeked", onSeeked );
  });

  slideOptions.endHandlers.push(function() {
    elPopcorn.pause();
    SD.popcorn.off( "play", onPlay );
    SD.popcorn.off( "pause", onPause );
    SD.popcorn.off( "seeked", onSeeked );
  });

  function onPlay() {
    elPopcorn.play();
  }

  function onPause() {
    elPopcorn.pause();
  }

  function onVolumeChange() {
    elPopcorn.volume( SD.popcorn.volume() );
  }

  function onSeeked() {
    elPopcorn.currentTime( SD.popcorn.currentTime() - slideOptions.start );
  }
};

}())
