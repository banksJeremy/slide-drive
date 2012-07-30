addEventListener( "DOMContentLoaded", function() {
  "use strict";

  var printableElement = null,
      showingPrintable = false,
      inButter         = !!window.Butter,
      butter           = null,
      popcorn          = null,
      anchorTargetId   = null,
      deckInitialized  = false;

  init();

  window.SlideButterOptions = SlideButterOptions;
  function SlideButterOptions ( elOrId ) {
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

    if ( !(this instanceof SlideButterOptions) ) {
      return new SlideButterOptions( _el );
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

            initDeck();
          } else {
            initTimelineTargets();
          }
        }
      },

      slideId: {
        enumerable: true,
        get: function() {
          return getIdForEl( _el );
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
  }

  SlideButterOptions.prototype = {
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

  function init () {
    console.log( "Starting Slide Drive initialization." );

    // Butter adds <base> tag to our document to make sure the resouce paths are correct.
    // After loading, it will break our anchor links and have nasty side-effects.
    // var base = document.querySelector( "base" );
    // if ( base && base.getAttribute("href") === ".." ) {
    //   base.parentNode.removeChild( base );
    // }

    if ( window.location.hash > "#" ) {
      anchorTargetId = window.location.hash.substr( 1 );
    }

    if ( inButter ) {
      Butter({
        config: "/external_configs/butter/config.json",
        ready: function ( butter_ ) {
          butter = butter_;
          window.butter = butter; // TODO remove this after debugging
          initMediaAndWait();
        }
      });
    } else {
      initMediaAndWait();
    }
  }

  // Initializes the media player then waits for media to be ready.
  function initMediaAndWait () {
    console.log( "Initializing media player and waiting for it to be ready." );

    var pollUntilReady;

    $("audio").mediaelementplayer({
      // enablePluginDebug: true,

      success: pollUntilReady = function ( mediaElement, domObject ) {
        window.popcorn = popcorn = Popcorn( mediaElement, { frameAnimation: false });

        console.log( "MediaElement ready, waiting for popcorn.readyState() >= 2 (currently " + popcorn.readyState() + ")" );

        if ( popcorn.readyState() >= 2 ) {
          console.log("popcorn.readyState() >= 2, continuing.");

          if ( !inButter ) {
            initAfterMediaReady();
          } else {
            console.log( "butter.readyState() is ready, waiting for butter.media[ 0 ].onReady()." );

            butter.media[ 0 ].onReady(function () {
              initAfterMediaReady();
            });
          }
        } else {
          console.log("waiting...");
          setTimeout( pollUntilReady, 250,  mediaElement, domObject  );
        }
      }
    });
  }

  // Initialization to take place after media (and Butter)? is ready.
  function initAfterMediaReady () {
    console.log( "Media ready, continuing initialization." );

    if ( inButter ) {
      butter.page.listen( "getHTML", function ( e ) {
        var root = e.data;

        // Remove the rendered controls from around the audio element.
        var renderedContainer = root.querySelector( ".mejs-container" ),
            containedAudio = renderedContainer.querySelector( "audio" );

        renderedContainer.parentNode.replaceChild( containedAudio, renderedContainer );

        // We don't want Butter's copy of the popcorn events. They'll have been mirrored
        // back into the DOM, which we'll parse them back out of.
        // This will need a bit more nuance when other Popcorn events can be added.

        var pageScripts = root.querySelectorAll( "script" ),
            lastScript = pageScripts[ pageScripts.length - 1 ];

        lastScript.parentNode.removeChild( lastScript );

        // Add Deck.js Hash extension. We don't want this active in Butter,
        // so we don't add it until it's exported.

        var deckHashStyle = document.createElement( "link" );
        deckHashStyle.rel = "stylesheet";
        deckHashStyle.href = "external/deckjs/extensions/hash/deck.hash.css";
        root.querySelector( "head" ).appendChild( deckHashStyle );

        var deckHashScript = document.createElement( "script" );
        deckHashScript.src = "external/deckjs/extensions/hash/deck.hash.js";
        root.querySelector( "body" ).appendChild( deckHashScript );
      });

      // Bind file drop handling to each Butter track.
      butter.media[ 0 ].listen( "trackadded" , function( e ) {
        var track = e.data;
        track.view.listen( "filesdropped", function( e ) {
          onDroppedFilesOnTrack( e.data.files, e.data.track, e.data.start );
        });
      });
    }

    // Parse slide data into live Popcorn events or Butter timeline events.
    var butterTrack,
        addEvent = inButter ? function ( options ) { butterTrack.addTrackEvent({ type: "slidedrive", popcornOptions: options }); }
                            : function ( options ) { popcorn.slidedrive( options ); };

    if ( inButter ) {
      butterTrack = butter.media[ 0 ].addTrack( "Slides" );
    }

    var slidesEls = document.querySelectorAll( ".slide" ),
        slideEvents = [],
        currentOptions, previousOptions = null;

    for ( var i = 0; i < slidesEls.length; ++i ) {
      currentOptions = SlideButterOptions( slidesEls[ i ] );

      if ( previousOptions ) {
        previousOptions.end = currentOptions.start - 0.001;
      }

      slideEvents.push( currentOptions );

      previousOptions = currentOptions;
    }

    previousOptions.end = popcorn.duration();

    for ( var i = 0; i < slideEvents.length; ++i ) {
      addEvent( slideEvents[ i ] );
    }

    // $.deck.enableScale();

    initEvents();

    initDeck();

    fixSVGs();
    svgsRequireRescaling();

    // The popcorn event for slide 0 isn't fired properly if the video starts inside it, so
    // we need to move out of it and back to it.
    $.deck("next");
    $.deck("prev");

    [].forEach.call( document.querySelectorAll( "video" ), syncVideo );

    if ( location.search.match( /(^\?|&)autoplay=1(&|$)/ ) ) {
      popcorn.play();
    }

    window._slideDriveReady = true; // required for tests
  }
  
  function initDeck() {
    // If we haven't yet moved to the permalink target, restore that after initialization
    // instead of this one?

    if ( deckInitialized ) {
      // Re-initializing the Deck will add any new slides, but it causes the
      // presentation to be reset to the first slide, so we preserve its state.
      console.log("Re-initializing Deck.js.");

      var currentTime = popcorn.currentTime(),
          currentSlide$ = $.deck( "getSlide" ),
          currentSlideOptions = currentSlide$ && SlideButterOptions( currentSlide$[ 0 ] );

      $.deck( ".slide" );

      if ( currentSlide$ && currentTime >= currentSlideOptions.start && currentTime <= currentSlideOptions.end ) {
        $.deck( "go", currentSlideOptions.slideId );
      } else {
        // A new slide might have been placed at the current time, we need to make
        // sure we jump back to into it to be sure it's activated.
        popcorn.currentTime( 0 );
      }

      popcorn.currentTime( currentTime );
    } else {
      console.log("Initializing Deck.js.");
      
      deckInitialized = true;
      $.deck( ".slide" );

      if ( anchorTargetId != null ) {
        console.log("Navigating to permalink target #" + anchorTargetId);
        
        $.deck( "go", anchorTargetId );
      }
    }
    
    initTimelineTargets();
  }

  // Initialize keyboard shorcuts (disable Deck's if in Butter, else enable our own).
  // Oh, and Popcorn responses to Deck card changes, too!
  function initEvents () {
    if ( inButter ) {
      console.log( "Deactivating Deck.js keyboard shortcuts." );
      // You can define new key bindings, but removing existing ones doesn't seem to work.
      // Instead we'll explicitly unbind any listeners on document for keydown.deck*.

      var events = $( document ).data( "events" ).keydown,
          toRemove = [];

      for ( var i = 0; i < events.length; i++ ) {
        if ( /^deck/.test( events[i].namespace ) ) {
          toRemove.push( events[i].type + "." + events[i].namespace );
        }
      }

      for ( var i = 0; i < toRemove.length; i++ ) {
        $( document ).off( toRemove[ i ] );
      }

      butter.media[ 0 ].listen( "trackeventremoved", function( e ) {
        if ( e.data.type === "slidedrive" ) {
          var slideId = e.data.popcornOptions.slideId;
          var el = document.getElementById( slideId );

          if ( el ) {
            el.parentNode.removeChild( el );
          }

          initDeck();
        }
      });
    } else {
      console.log( "Activating our keyboard shortcuts." );

      document.addEventListener( "keydown", function( e ) {
        if ( e.keyCode === 80 ) {
          if ( !popcorn.paused() ) {
            popcorn.pause();
          } else {
            popcorn.play();
          }
        } else if( e.keyCode === 84 ) {
          if( !printableElement ) {
            printableElement = initPrintable();
          }
          if( !showingPrintable ) {
            printableElement.style.display = "";
            document.getElementById( "main" ).style.display = "none";
          } else {
            printableElement.style.display = "none";
            document.getElementById( "main" ).style.display = "";
          }
          showingPrintable = !showingPrintable;
        }
      }, false);
    }

    $(document).bind( "deck.change", function( event, from, to ) {
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

      var toSlide = SlideButterOptions( slide ),
          fromSlide = SlideButterOptions( slide ),
          currentTime = popcorn.currentTime();

      document.getElementById( "slideshow-transcript" ).innerHTML = toSlide.transcriptSource;

      var outsideOfTarget = currentTime < toSlide.start || currentTime >= toSlide.end;
      if ( outsideOfTarget ) {
        console.log("Updating currentTime to match slide: ", toSlide.start, toSlide.slideId)
        popcorn.currentTime( toSlide.start );
      }
    });

    window.addEventListener("resize", function() {
      svgsRequireRescaling();
    });
  }
  
  // Debounce - scale all 200ms after last call.
  var svgsRequireRescaling = debounce(function() {
    var svgs = document.querySelectorAll("svg"), i, l;
    for ( i = 0, l = svgs.length; i < l; ++i ) {
      SVGHelper( svgs[ i ] ).fitIn( document.querySelector( ".deck-container" ) );
    }
  }, 200);

  // Creates and returns a new debounced version of the passed nullary
  // function that will postpone its execution until after interval ms
  // have elapsed since the last time it was invoked.
  function debounce( f, interval ) {
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

  /* Verifies that the right type of files were dropped, otherwise displays an error.
     If they have been then unbind the drop handlers, read the file and continue to handleDroppedSVG.
  */
  function onDroppedFilesOnTrack ( files, track, time ) {
    var i, l, file, reader, slidesToPassOver = 0;

    for ( i = 0, l = files.length; i < l; ++i ) {
      file = files[ i ];
      reader = new FileReader();

      if ( file.type !== "image/svg+xml" ) {
        continue;
      }

      console.log( "Reading SVG..." );

      reader.readAsText(file, "UTF-8" );
      reader.onloadend = onReaderLoaded;
    }

    function onReaderLoaded() {
      if ( this.readyState !== FileReader.DONE ) {
        return;
      }

      var tmpContainer = document.createElement( "div" ),
          svgRoot,
          newSlideCount;

      tmpContainer.innerHTML = this.result;
      svgRoot = tmpContainer.querySelector( "svg" );

      newSlideCount = svgRoot.querySelectorAll( ".Slide" ).length;

      handleDroppedSVG( svgRoot, track, time + 1 * slidesToPassOver );

      slidesToPassOver += newSlideCount;
    }
  }

  /* Given the root of a loaded SVG element, proccess it and split into elements for each slide.
     Calls addSlide on each processed slide.
  */
  function handleDroppedSVG ( root, track, start ) {
    console.log( "Read SVG from file." );

    var i, j, k,
        l, m, n;

    // Embedded fonts? Detach before cloning, then re-add to the first slide.
    var i, l, f, d;

    var fontUsers = root.querySelectorAll( "[font-family] ");

    for ( i = 0, l = fontUsers.length; i < l; ++i ) {
      var element = fontUsers[ i ],
          fontFamily = element.getAttribute( "font-family" );

      fontFamily = fontFamily.replace( / embedded$/, '' ).toLowerCase();

      element.setAttribute( "font-family", fontFamily );
    }

    // TODO use extractFonts
    $( "font", root ).each(function() {
      SVGHelper.fontManager.loadFont( this );
    });
    SVGHelper.fontManager.writeFonts();

    $( "font, font-face, missing-glyph, glyph", root ).remove();

    var svgSlideSubtrees = root.querySelectorAll( ".Slide" ),
        svgSlideIds = $.map( svgSlideSubtrees, function( el ) {
          return el.getAttribute( "id" );
        });

    $( svgSlideSubtrees ).removeClass( "Slide" ).addClass( "libreoffice-slide" );
    
    /*
    var possibleSubslides = getPossibleSubslides( root, function( el ) {
      getIdForEl( el );
    });
    
    (function recur( indentation, children ) {
      // console.log( indentation + "(")
      for (var i = 0; i < children.length; ++i) {
        var child = children[ i ];
        
        if ( typeof child === "string" ) {
          console.log( indentation + child );
        } else {
          recur( indentation + "- ", child.children );
        }
      }
      // console.log( indentation + ")")
    }( " ", possibleSubslides ));
    */

    SVGHelper( root ).removeInvisibles().minify();

    var slides = document.querySelectorAll( ".deck-container .slide" );

    var cumulativeDuration = 0;

    i = 0;
    var addSlideInterval = setInterval(function() {
      if ( i >= svgSlideIds.length ) {
        clearInterval( addSlideInterval );

        return;
      }

      var svgSlideId = svgSlideIds[ i ],
          svgSlide = root.cloneNode( true );

      var j, candidate, cruftsAndSlide = svgSlide.querySelectorAll( ".libreoffice-slide" );

      for ( j = 0; j < cruftsAndSlide.length; j++ ) {
        candidate = cruftsAndSlide[ j ];

        if ( candidate.getAttribute( "id" ) !== svgSlideId ) {
          candidate.parentNode.removeChild( candidate );
        } else {
          candidate.setAttribute( "visibility", "visible" );
        }
      }

      var container = document.querySelector( ".deck-container" );

      var slideEl = document.createElement( "section" ),
          transEl = document.createElement( "div" );

      slideEl.setAttribute( "class", "slide" );
      slideEl.setAttribute( "data-popcorn-slideshow", start + cumulativeDuration );
      
      var duration = (popcorn.duration() - start - cumulativeDuration) * .10,
          popcornOptions = SlideButterOptions( slideEl );

      cumulativeDuration += duration;
      popcornOptions.end = cumulativeDuration;

      transEl.setAttribute( "class", "transcript" );

      slideEl.appendChild( transEl );
      
      slideEl.appendChild( svgSlide );

      container.appendChild( slideEl );

      jQuery(".com\\.sun\\.star\\.drawing\\.LineShape mask", svgSlide).remove();

      // Need to do this after adding to document or overlaySelectableSpans's
      // will get confused about the geometry.
      var SVGHelperEl = SVGHelper( svgSlide )
        .fixTextSelection() // fix text selection in Firefox
        .joinAdjacentTextEls() // fix text selection in Chrome
        .fixXlinkAttrSerialization() // fix serialization in Chrome
        .removeInvisibles()
        .minify()
        .containerEl;

      svgsRequireRescaling();

      track.addTrackEvent({
        type: "slidedrive",
        popcornOptions: popcornOptions
      });

      initDeck();

      i++;
    }, 200);
  }
  
  function getPossibleSubslides( root, callback ) {
    var rootChildren = [];
    
    var i, l, child, grandchildren;
    
    for ( i = 0, l = root.childNodes.length; i < l; ++i ) {
      child = root.childNodes[ i ];
      
      if ( child.nodeName === "text" ) {
        var textContent = child.textContent;
        
        if ( textContent.length > 0 ) {
          callback( child );
        
          rootChildren.push({
            el: child,
            children: [ child.textContent ]
          });
        }
      } else {
        grandchildren = getPossibleSubslides( child, callback );
        
        if ( grandchildren.length > 1 ) {
          callback( child );
          
          rootChildren.push({
            el: child,
            children: grandchildren
          });
        } else if ( grandchildren.length === 1 ) {
          callback( child );
          
          rootChildren.push({
            el: child,
            children: grandchildren[ 0 ].children
          });
        }
      }
    }
    
    return rootChildren;
  }

  // Returns the "id" attribute value for a given element.
  // If the element does not have an "id" attribute defined, it is given a random one based on its text content.-
  function getIdForEl( el ) {
    if ( el.hasAttribute( "id" ) ) {
      return el.getAttribute( "id" );
    } else {
      var id = (el.textContent.replace( /[^a-z0-9]/gi, '' ).substring( 0, 8 )
                .toLowerCase() || "s") + "-" + ( Math.random() * (1 << 30) | 0 ).toString( 36 );
      el.setAttribute( "id", id );
      return id;
    }
  }
  
  function initPrintable () {
    var body = document.getElementById( "printable" ),
        bodyChildren = document.getElementById( "main" ).getElementsByTagName( "section" );

    for( var i = 0, l = bodyChildren.length; i < l; i++ ) {
      var slideContainer = document.createElement("slideContainer"),
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

  function initTimelineTargets () {
    console.log( "Setting slide indicators on timeline." );

    var parent = document.querySelector( ".mejs-time-total" ),
        container = document.createElement( "div" ),
        slidesFromDeck = $.deck( "getSlides" ),
        slides = slidesFromDeck ? slidesFromDeck.map( function( $el ) { return $el[ 0 ]; } ) : [],
        existingIndicators = document.querySelector( ".timeline-indicators" ),
        totalTime = popcorn.duration(),
        i, l, slide, slideOptions, markEl, startTime;

    if ( existingIndicators ) {
      existingIndicators.parentNode.removeChild( existingIndicators );
    }

    parent.style.position = "relative";
    container.classList.add( "timeline-indicators" );

    for ( i = 0, l = slides.length; i < l; ++i ) {
      slide = slides[ i ];
      startTime = SlideButterOptions( slide ).start;

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
  }
  
  function fixSVGs () {
    var svgs = [].slice.call( document.querySelectorAll( "svg" ) ), i, l;
    $(".com\\.sun\\.star\\.drawing\\.LineShape mask").remove();
    
    for ( i = 0, l = svgs.length; i < l; ++i ) {
      SVGHelper( svgs[ i ] )
        .fixTextSelection() // fix text selection in Firefox
        .joinAdjacentTextEls() // fix text selection in Chrome
        .fixXlinkAttrSerialization(); // fix serialization in Chrome
    }
  }

  /*
    So... we want to be able to sync embedded videos to the master popcorn object.
    Does adjusting currentTime count as seeking? I think not. Therefore it is impossible
    to detect specific jumps, instead of regular playing, so we will have to sync.
    
    It does count as seeking!
    So we just need to watch... play, pause, volumechange, seeked... and let's pause on seeking.
    
    None of these events are too frequent, so making it general, rather than optimizing it, is doable.
  */
  
  // End will be the end of the last child slide of the current slide?
  // Screwit we don't have subslides yet.
  // Hmm... can you attach other handlers to the start and end events (are they events) of a track event?
  // That would be the best solution... although we would still need some way to get a reference to
  // the track event. If SlideButterOptions were initialized in inside the event's stuff, it could be done
  // there. We could special-case re-instantiation in that context to update the existing object before
  // returning it.
  function syncVideo( el ) {
    console.log("Setting up synced video.")

    var slideOptions = SlideButterOptions( $( el ).closest( ".slide" )[ 0 ] ),
        elPopcorn = Popcorn( el ),
        wasPlaying = false;

    el.controls = false;
    popcorn.on( "volumechange", onVolumeChange );

    slideOptions.startHandlers.push(function() {
      elPopcorn.currentTime( popcorn.currentTime() - slideOptions.start );
      elPopcorn.play();
      popcorn.on( "play", onPlay );
      popcorn.on( "pause", onPause );
      popcorn.on( "seeked", onSeeked );
    });

    slideOptions.endHandlers.push(function() {
      elPopcorn.pause();
      popcorn.off( "play", onPlay );
      popcorn.off( "pause", onPause );
      popcorn.off( "seeked", onSeeked );
    });

    function onPlay() {
      elPopcorn.play();
    }

    function onPause() {
      elPopcorn.pause();
    }

    function onVolumeChange() {
      elPopcorn.volume( popcorn.volume() );
    }

    function onSeeked() {
      elPopcorn.currentTime( popcorn.currentTime() - slideOptions.start );
    }
  }
}, false );
