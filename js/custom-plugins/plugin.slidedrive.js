(function ( Popcorn ) {

  Popcorn.plugin( "slidedrive" , {
      manifest: {
        about: {
          name: "Slide Drive plugin",
          author: "David Seifried",
          website: "http://dseifried.wordpress.com/"
        },
        options: {
          start: {
            elem: "input",
            type: "number",
            label: "In"
          },
          end: {
            elem: "input",
            type: "number",
            label: "Out"
          },
          slideId: {
            elem: "input",
            type: "text",
            label: "Slide (id)"
          },
          transcriptSource: {
            elem: "textarea",
            type: "text",
            label: "Transcript (HTML)"
          }
        }
      },
      _setup: function( options ) {
        options._slideButterOptions = SD.SlideButterOptions( document.getElementById( options.slideId ) );
      }, 
      start: function( event, options ) {
        if ( (options._slideButterOptions || options)._onstart() === false ) {
          return;
        }

        $.deck( "go", options.slideId );
      },
      end: function( event, options ) {
        if ( (options._slideButterOptions || options)._onend() === false ) {
          return;
        }

      },
    });
})( Popcorn );
