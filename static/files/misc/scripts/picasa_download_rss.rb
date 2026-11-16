#!/usr/bin/env ruby
#
# Simple script to download photos from a Picasa web album given the RSS feed.
# Photos are downloaded with wget in a subdirectory of the current location,
# named according to the title of the album.
# (c)2007, Jordan Augé, released under the WTFPL
#

require 'net/http'

if ARGV.length != 1
  raise ArgumentError, "This scripts takes the URL of the RSS feed as argument" 
end

rx_photos = /media:content url='(.*?)'/
rx_title = /<title>(.*?)<\/title>/
page = Net::HTTP.get(URI.parse(ARGV[0]))
dir = page[rx_title, 1].tr(' ', '_')
page.scan(rx_photos).to_a.each { |file| %x{wget -P #{dir} #{file}} }
