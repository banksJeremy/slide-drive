addEventListener( "DOMContentLoaded", function() {
  "use strict";

  var printableElement = null,
      showingPrintable = false,
      inButter         = !!window.Butter,
      butter           = null,
      fromButter       = !inButter && document.querySelector( "body" ).hasAttribute( "data-butter-crufted" ),
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

  function init () {
    console.log( "Starting Slide Drive initialization." );

    if ( fromButter ) {
      // Butter adds <base> tag to our document to make sure the resouce paths are correct.
      // After loading, it will break our anchor links and have nasty side-effects.

      var base = document.querySelector( "base" );
      base.parentNode.removeChild( base );

    }

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

    popcorn = Popcorn( "#audio", { frameAnimation: true });

    window.popcorn = popcorn; // TODO remove this after debugging

    var pollUntilReady;

    $("audio").mediaelementplayer({
      success: pollUntilReady = function () {
        console.log( "MediaElement ready, waiting for popcorn.readyState() >= 2 (currently " + popcorn.readyState() + ")" );

        if ( popcorn.readyState() >= 2 ) {
          console.log("ready...");

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
          setTimeout( pollUntilReady, 250 );
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

    initDeck();

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
        previousOptions.end = currentOptions.start;
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
    initTimelineTargets();

    if ( anchorTargetId != null ) {
      $.deck( "go", anchorTargetId);
    }

    window._slideDriveReady = true; // required for tests
  }

  function initDeck() {
    if ( deckInitialized ) {
      // Re-initializing the Deck will add any new slides, but it causes the
      // presentation to be reset to the first slide, so we preserve its state.

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
      deckInitialized = true;
      $.deck( ".slide" );
    }
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
      
      var oldMedia = oldSlide.querySelectorAll( ".synced-media" ),
          newMedia = slide.querySelectorAll( ".synced-media" );

      for ( i = 0, l = oldMedia.length; i < l; ++i ) {
        Popcorn( oldMedia[ i ] ).pause();
      }

      for ( i = 0; i < newMedia.length; ++i ) {
        var media = Popcorn( newMedia[ i ] );
        media.currentTime( 0 );
        media.play();
      }

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

      if (currentTime < toSlide.start || currentTime > toSlide.end) {
        popcorn.currentTime( toSlide.start );
      }
    });

  }

  /* Verifies that the right type of files were dropped, otherwise displays an error.
     If they have been then unbind the drop handlers, read the file and continue to handleDroppedSVG.
  */
  function onDroppedFilesOnTrack ( files, track, time ) {
    var i, l, file, reader;

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
          svgRoot;

      tmpContainer.innerHTML = this.result;
      svgRoot = tmpContainer.querySelector( "svg" );

      handleDroppedSVG( svgRoot, track, time );
    }
  }

  // Maps of lowercase known font names to list of fallback fnts.
  // The system copy will have top priority, followed by the embedded version, then the fallbacks.

  var knownFonts = {
    // We expect "safer" fonts or metrics-maching fallbacks to be present on ~90%+ of systems.
    safer: {
      "arial": [ "Liberation Sans", "Helvetica", "Arimo", "sans-serif" ],
      "helvetica": [ "Liberation Sans", "Arial", "Arimo", "sans-serif" ],
      "liberation sans": [ "Helvetica", "Arial", "Arimo", "sans-serif" ],
      "arimo": [ "Liberation Sans", "Helvetica", "Arial", "sans-serif" ],

      "times new roman": [ "Liberation Serif", "Times", "Tinos", "serif" ],
      "times": [ "Times New Roman", "Liberation Serif", "Tinos", "serif" ],
      "liberation serif": [ "Times New Roman", "Times", "Tinos", "serif" ],
      "tinos": [ "Liberation Serif", "Times New Roman", "Times", "serif" ],

      "courier new": [ "Liberation Mono", "Cousine", "monospace" ],
      "liberation mono": [ "Courier New", "Cousine", "monospace" ],
      "cousine": [ "Liberation Mono", "Courier New", "monospace" ],

      "arial black": [ "sans-serif" ],

      "georgia": [ "serif" ],

      "impact": [ "sans-serif" ]
    },

    unsafe: {
      "arial narrow": [ "Liberation Sans Narrow", "sans-serif" ],
      "liberation sans narrow": [ "arial narrow", "sans-serif" ],

      "menlo": [ "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "monospace" ],
      "dejavu sans mono": [ "Bitstream Vera Sans Mono", "menlo", "monospace" ],
      "bitstream vera sans mono": [ "DejaVu Sans Mono", "menlo", "monospace" ],

      "courier": [ "monospace" ],

      "consolas": [ "monospace" ],

      "monaco": [ "monospace" ],

      "lucida console": [ "monospace" ]
    }
  };

  function makeFontStack( fontName ) {
    fontName = fontName.replace( / embedded$/, '' );

    var fontKey = fontName.toLowerCase(),
        fontNames = [ fontName, fontName + " embedded" ];

    if ( fontKey in knownFonts.safer ) {
      fontNames.push.apply( fontNames, knownFonts.safer[ fontKey ] );
    } else if ( fontKey in knownFonts.unsafe ) {
      fontNames.push.apply( fontNames, knownFonts.unsafe[ fontKey ] );
    }

    return fontNames.join( "," );
  }

  function makeFontEmbedder ( root ) {
    var fontEls = $.map( root.querySelectorAll( "font-face" ), function( el ) {
      el.cloneNode( true );
    }),
        fonts = {},
        i, l;

    for ( i = 0, l = fontEls.length; i < l; ++i ) {
      var fontEl = fontEls[ i ],
          key = fontKey( fontEl.getAttribute( "font-family" ),
                         fontEl.getAttribute( "font-weight" ),
                         fontEl.getAttribute( "font-style" ) ),
          unitsPerEm = +(fontEl.getAttribute( "units-per-em" ) || 1000),
          glyphEls = fontEl.querySelectorAll( "glyph" ),
          font = fonts[ key ],
          j, m;

      if ( !font ) {
        fonts[ key ] = font = {};
      }

      for ( j = 0, m = glyphEls.length; j < m; ++j ) {
        font[ glyphEls[ i ].getAttribute( "unicode" ) ] = glyphEls[ i ].getAttribute( "d" );
      }
    }

    return embedFonts;

    function fontKey ( family, weight, style ) {
      return family + "\n" + (weight || "normal") + "\n" + (style || "normal");
    }

    function embedFonts ( el ) {
      var family = el.style.fontFamily,
          weight = el.style.fontWeight,
          style = el.style.fontStyle,
          key = fontKey( family, weight, style ),
          emSize = el.style.fontSize,
          emSizeUnitless,
          dummySizeEl = document.createElementNS( "http://www.w3.org/2000/svg", "g" ),
          text = el.textContent;

      dummySizeEl.style.height = emSize;
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

    var fontUsage = {},
        fontUsers = root.querySelectorAll( "[font-family] ");

    for ( i = 0, l = fontUsers.length; i < l; ++i ) {
      var element = fontUsers[ i ],
          fontFamily = element.getAttribute( "font-family" );

      fontFamily = fontFamily.replace( / embedded$/, '' ).toLowerCase();

      if ( !(fontFamily in fontUsage) ) {
        fontUsage[ fontFamily ] = [ element ];
      } else {
        fontUsage[ fontFamily ].push( element );
      }

      element.setAttribute( "font-family", makeFontStack( fontFamily ) );
    }

    // TODO - display this somewhere
    for ( var name in fontUsage ) {
      if ( fontUsage.hasOwnProperty( name ) ) {
        var status;
        if ( name in knownFonts.safer ) {
          status = "Safe";
        } else if ( name in knownFonts.unsafe ) {
          status = "Known, Unsafe";
        } else {
          status = "Unknown, Unsafe";
        }
      }
    }

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
    
    var slides = document.querySelectorAll( ".deck-container .slide" );

    var cumulativeDuration = (slides[ slides.length - 1 ] && slides[ slides.length - 1 ].getAttribute( "data-popcorn-slideshow" ) || 0) + 3;

    i = 0;
    var addSlideInterval = setInterval(function() {
      if ( i >= svgSlideIds.length ) {
        clearInterval( addSlideInterval );

        return;
      }

      var svgSlideId = svgSlideIds[ i ],
          svgSlide = root.cloneNode( true );

      // We only want embedded fonts to be included in the first slide, because from there it will be
      // usable from the others, so we remove them from the root after the first slide is cloned.
      if ( i === 0 ) {
        $( "font, font-face, missing-glyph", root ).remove();
      }

      var j, candidate, cruftsAndSlide = svgSlide.querySelectorAll( ".libreoffice-slide" );

      for ( j = 0; j < cruftsAndSlide.length; j++ ) {
        candidate = cruftsAndSlide[ j ];

        if ( candidate.getAttribute( "id" ) !== svgSlideId ) {
          candidate.parentNode.removeChild( candidate );
        } else {
          candidate.setAttribute( "visibility", "visibile" );
        }
      }

      var hiddenElements = svgSlide.querySelectorAll( "[visible=hidden]" );

      // Remove hidden elements - they're of no interest to us.
      for ( j = 0; j < hiddenElements.length; j++ ) {
        hiddenElements[ j ].parentNode.removeChild( hiddenElements[ j ] );
      }

      var container = document.querySelector( ".deck-container" );

      var slideEl = document.createElement( "section" ),
          transEl = document.createElement( "div" );

      slideEl.setAttribute( "class", "slide" );
      slideEl.setAttribute( "data-popcorn-slideshow", start + i * 1 ); // TODO better start times

      transEl.setAttribute( "class", "transcript" );

      slideEl.appendChild( transEl );
      
      slideEl.appendChild( svgSlide );

      container.appendChild( slideEl );

      // Need to do this after adding to document or fixTextSelection's
      // will get confused about the geometry.
      var svgContainerEl = SVGContainer( svgSlide )
        .padTextViewports().fixXlinkAttrs().reparse().fixTextSelection() // fix text selection in Firefox
        .joinAdjacentTextEls().fixXlinkAttrs().reparse() // fix text selection in Chrome
        .fixXlinkAttrs() // prevent next reparsing from breaking in Chrome
        // .scaleTo( "height" )
        .containerEl;

      // svgContainerEl.style.height = "100%";

      track.addTrackEvent({
        type: "slidedrive",
        popcornOptions: SlideButterOptions( slideEl )
      });

      cumulativeDuration += 5;

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
    var container = document.querySelector( ".mejs-time-total" ),
        slides = $.deck( "getSlides" ).map( function( $el ) { return $el[ 0 ]; } ),
        totalTime = popcorn.duration(),
        i, l, slide, slideOptions, markEl, startTime;
    
    container.style.position = "relative";
    for ( i = 1, l = slides.length; i < l; ++i ) {
      slide = slides[ i ];
      startTime = SlideButterOptions( slide ).start;
      
      markEl = document.createElement( "div" );
      markEl.style.position = "absolute";
      markEl.style.top = 0;
      markEl.style.height = "10px";
      markEl.style.width = "1px";
      markEl.style.background = "black";
      markEl.style.left = (startTime / totalTime) * 100 + "%";
      
      container.appendChild( markEl );
    }
  }
}, false );
