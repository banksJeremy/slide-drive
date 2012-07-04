#!/usr/bin/env python
import os
import os.path
import webbrowser
from itertools import islice
from boto.s3.connection import S3Connection

# set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in env.

s3 = S3Connection()
bucket = S3Connection().create_bucket("slide-drive-demo")

print "Loading examples/demo.html"

demo_source = open("examples/demo.html", "rb").read().replace("http://localhost:8888/", "/")

print "Uploading modified examples/demo.html"

demo_key = bucket.new_key("examples/demo.html")
demo_key.metadata.update({ "Content-Type": "text/html" })
demo_key.set_contents_from_string( demo_source )
demo_key.make_public()

bulk_paths = [
  "js",
  "css",
  "examples/demo-audio.mp3",
  "examples/demo-external-page.html",
  "external/deckjs",
  "external/jquery",
  "external/mediaelement/build/mediaelement-and-player.js",
  "external/modernizr",
  "external/butter/src/butter.js",
  "external/butter/css/butter.ui.css",
  "external/butter/css/butter.ui.deprecated.css",
  "external/butter/external/popcorn-js/modules/player/popcorn.player.js",
  "external/butter/external/popcorn-js/modules/player/popcorn.player.js",
  "external/butter/external/popcorn-js/popcorn.js",
  "external/butter/external/require"
]

for path in bulk_paths:
  if os.path.isfile( path ):
    print "Uploading", path
    key = bucket.new_key( path )
    key.set_contents_from_file( open(path, "rb") )
    key.make_public()
  
  elif os.path.isdir( path ):
    for path_prefix, _, filenames in os.walk( path ):
      for filename in filenames:
        full_path = path_prefix + "/" + filename
        print "Uploading", full_path
        
        key = bucket.new_key( full_path )
        key.set_contents_from_file( open(full_path, "rb") )
        key.make_public()
  
  else:
    print "Skipping non-file non-directory", path


webbrowser.open("http://slide-drive-demo.s3.amazonaws.com/examples/demo.html")