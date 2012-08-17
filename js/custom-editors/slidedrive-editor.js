
(function( Butter ) {

  Butter.Editor.register( "slidedrive", "load!/js/custom-editors/slidedrive-editor.html",
    function( rootElement, butter, compiledLayout ) {
        var _this = this;

        Butter.Editor.TrackEventEditor( _this, butter, rootElement, {
          open: function( parentElement, trackEvent ) {
            var popcorn = butter.currentMedia.popcorn.popcorn;

            _butter = butter;
            // Update properties when TrackEvent is updated
            trackEvent.listen( "trackeventupdated", function ( e ) {
              _this.updatePropertiesFromManifest( e.target );
              // setErrorState( false );

            });

            // setup( trackEvent );

          },
          close: function() {
            
          }
        });

    });
}( window.Butter ))