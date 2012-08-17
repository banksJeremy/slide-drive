(function() {
"use strict";
Butter, __sd;

var NS_SVG = "http://www.w3.org/2000/svg",
    NS_XLINK = "http://www.w3.org/1999/xlink";

var SD = __sd;
SD.editing = true;
SD.butter = null;
SD.transcriptEditor = null;

// Modifies a clone of the document used to export from Butter as HTML.
SD.onButterPageGetHTML = function ( e ) {
  var root = e.data;

  // Remove the rendered controls from around the audio element.
  var renderedContainer = root.querySelector( ".mejs-container" ),
      containedAudio = renderedContainer.querySelector( "audio" );

  renderedContainer.parentNode.replaceChild( containedAudio, renderedContainer );

  // Multiple <sources> may be available for the <audio>, but this is mangled by browsers
  // promoting their preferred format to the src= of the <audio>. So, we'll remove the src=
  // attribute if there are <source>s included.

  if ( containedAudio.hasAttribute( "src" ) && containedAudio.querySelector( "source" ) ) {
    containedAudio.removeAttribute( "src" );
  }

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
  root.querySelector( "body" ).appendChild( deckHashScript );}

SD.onButterTrackFilesDropped = function( files, track, start ) {
  var i, l, file, reader, slidesToPassOver = 0;

  for ( i = 0, l = files.length; i < l; ++i ) {
    file = files[ i ];
    reader = new FileReader();

    if ( file.type === "image/svg+xml" || file.name.match( /\.svg$/i ) ) {
      console.log( "Reading SVG file..." );
      reader.readAsText(file, "UTF-8" );
      reader.onloadend = onLoadedSVG;
    } else if ( file.type === "text/html" || file.name.match( /\.html$/i ) ) {
      console.log( "Reading HTML file..." );
      reader.readAsText(file, "UTF-8" );
      reader.onloadend = onLoadedHTML;
    } else {
      console.warning( "Ignoring file of unrecognized type and extension", file.type, file.name );
    }
  }

  function onLoadedSVG() {
    if ( this.readyState !== FileReader.DONE ) {
      return;
    }

    var tmpContainer = document.createElement( "div" ),
        svgRoot,
        newSlideCount;

    tmpContainer.innerHTML = this.result;
    svgRoot = tmpContainer.querySelector( "svg" );

    newSlideCount = svgRoot.querySelectorAll( ".Slide" ).length;

    SD.handleDroppedSVG( svgRoot, track, start + 1 * slidesToPassOver );

    slidesToPassOver += newSlideCount;
  }

  function onLoadedHTML() {
    if ( this.readyState !== FileReader.DONE ) {
      return;
    }

    var tmpContainer = document.createElement( "div" ),
        slidesRoot,
        newSlideCount;

    tmpContainer.innerHTML = this.result;
    slidesRoot = tmpContainer;

    newSlideCount = slidesRoot.querySelectorAll( ".slide" ).length;

    SD.handleDroppedHTML( slidesRoot, track, start + 1 * slidesToPassOver );

    slidesToPassOver += newSlideCount;
  }
}

SD.handleDroppedHTML = function( root, track, start ) {
  console.log( "Read HTML from file." );
  var slides = root.querySelectorAll( ".slide" ),
      i = 0,
      l = slides.length;

  var oldStyle = root.querySelector( "#SVGHelper-fontManager-style" );
  SVGHelper.fontManager._reload( oldStyle );
  SVGHelper.fontManager.writeFonts();

  var deckContainer = document.querySelector( ".deck-container" ),
      popcornOptions;

  for (; i < l; i++) {
    popcornOptions = SD.SlideButterOptions( slides[ i ] );
    deckContainer.appendChild( slides[i] );

    // cause it to be moved into the correct document order
    popcornOptions.start = popcornOptions.start;

    track.addTrackEvent({
      type: "slidedrive",
      popcornOptions: popcornOptions
    });
  }
  SD.initDeck();
}

SD.handleDroppedSVG = function( root, track, start ) {
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
    
    var duration = (SD.popcorn.duration() - start - cumulativeDuration) * .10,
        popcornOptions = SD.SlideButterOptions( slideEl );

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

    SD.svgsRequireRescaling();

    track.addTrackEvent({
      type: "slidedrive",
      popcornOptions: popcornOptions
    });

    SD.initDeck();

    i++;
  }, 200);
}

SD.initEditorEvents = function() {
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

  SD.butter.currentMedia.listen( "trackeventremoved", function( e ) {
    if ( e.data.type === "slidedrive" ) {
      var slideId = e.data.popcornOptions.slideId;
      var el = document.getElementById( slideId );

      if ( el ) {
        el.parentNode.removeChild( el );
      }

      SD.initDeck();
    }
  });

  document.getElementById( "sd-editor-add-link" ).addEventListener( "click", SD.promptAddSvgTextLink );
  document.getElementById( "sd-editor-remove-link" ).addEventListener( "click", SD.promptRemoveSvgLink );
  document.getElementById( "import-selector" ).addEventListener( "change", SD.onFilesSelected );
  document.getElementById( "activate-transcript-editor" ).addEventListener( "click", SD.showTranscriptEditor );
}

SD.promptAddSvgTextLink = function() {
  SD.promptForSelection( "svg text", "SVG text to link", function( err, target ) {
    if (err) return;

    var href = prompt( "Please enter a URL to link to this text to." );

    if ( href != null ) {
      var link = document.createElementNS( NS_SVG, "a" );
      link.setAttributeNS( NS_XLINK, "href", href );
      link.style.textDecoration = "underline";

      $( target ).wrap( link );
    }
  });
}

SD.promptRemoveSvgLink = function() {
  SD.promptForSelection( "svg a", "SVG link to remove", function( err, target ) {
    if (err) return;

    $( target ).replaceWith( $( target ).children() );
  });
}

SD.onFilesSelected = function( e ) {
  if (e.target.files.length)
    SD.onButterTrackFilesDropped( e.target.files, SD.butter.media[0].addTrack(), 0);
  this.value = "";
}

SD.currentSelectionCandidates = null;
SD.promptForSelection = function ( selector, label, callback ) {
  if ( SD.currentSelectionCandidates ) {
    callback( "Cancelled by new selection action." );
    $(SD.currentSelectionCandidates).removeClass("selectable-target").off("click", onClick);
  }

  SD.currentSelectionCandidates = $(selector);

  $(SD.currentSelectionCandidates).addClass("selectable-target").click(onClick);
  $("#selection-message").show().text( "Please select " + label );
  $("#selection-cancel").show().find("button").on("click", onCancel);

  function onClick() {
    $("#selection-message").hide();
    $(SD.currentSelectionCandidates).removeClass("selectable-target").off("click", onClick);
    $("#selection-cancel").hide().find("button").off("click", onCancel);
    callback( null, this );
    SD.currentSelectionCandidates = null;
    return false;
  }

  function onCancel() {
    $("#selection-message").hide();
    $(SD.currentSelectionCandidates).removeClass("selectable-target").off("click", onClick);
    $("#selection-cancel").hide().find("button").off("click", onCancel);
    callback( "cancelled" );
    SD.currentSelectionCandidates = null;
    return false;
  }
}

SD.showTranscriptEditor = function() {
  // We actually re-initialize each time, because otherwise changes won't be reflected yet.
  SD.transcriptEditor = SD.initTranscriptEditor();
  SD.transcriptEditor.style.display = "";
  document.getElementById( "main" ).style.display = "none";
  SD.svgsRequireRescaling();
}

// The transcript editor is very similar to the printable view, but with
// editable text whose changes are saved.
SD.initTranscriptEditor = function() {
  var body = document.getElementById( "transcript-editor" ),
      bodyChildren = document.getElementById( "main" ).getElementsByTagName( "section" );

  $(body).empty();

  var closeButton = document.createElement( "button" );
  closeButton.innerText = "Close";
  body.appendChild( closeButton );
  closeButton.addEventListener( "click", function() {
    SD.transcriptEditor.style.display = "none";
    document.getElementById( "main" ).style.display = "";
    SD.svgsRequireRescaling();
  });

  for( var i = 0, l = bodyChildren.length; i < l; i++ ) {
    var slideContainer = document.createElement("div"),
        slide = document.createElement( "div" ),
        transcript = document.createElement( "textarea" );

    slideContainer.className = "printable-container";

    slide.className = "printable-slide";
    transcript.className = "printable-transcript";

    var reflectChanges = (function(transcript, originalSlide) {
      return SD.debounce(function() {
        console.log( "Saving transcript changes." )
        SD.SlideButterOptions( originalSlide ).transcriptSource = transcript.value;
      }, 250);
    }(transcript, bodyChildren[ i ]));

    transcript.addEventListener( "keyup", reflectChanges );

    slide.appendChild( bodyChildren[ i ].cloneNode(true) );

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
        transcript.innerText = innerTrans;
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

  closeButton = document.createElement( "button" );
  closeButton.innerText = "Close";
  body.appendChild( closeButton );
  closeButton.addEventListener( "click", function() {
    SD.transcriptEditor.style.display = "none";
    document.getElementById( "main" ).style.display = "";
    SD.svgsRequireRescaling();
  });

  return document.getElementById("transcript-editor");
};


}());
