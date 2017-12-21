var slug = require('slug');

/**
 * A metalsmith plugin to create a global tags object to organize posts and pages.
 *
 * @return {Function}
 */
function plugin(opts) {
  /**
   * Holds a mapping of tag names to an array of files with that tag.
   * @type {Object}
   */
  var tagList = {};

  // TODO: Documentation for this
  // TODO:
  // all this can be simplified with Object.assign...or a polyfill for it
  opts = opts || {};
  opts.path = opts.path || 'tags/:tag/index.html'; // TODO: offer better interpolation
  opts.pathPage = opts.pathPage || 'tags/:tag/:num/index.html';
  opts.layout = opts.layout || 'partials/tag.hbt'; // TODO: I think an error should be thrown 
  opts.handle = opts.handle || 'tags';
  opts.metadata = opts.metadata || {}; // should mirror metalsmith-collections functionality by the same name
  // options above should be merged to the array object
  opts.metadatakey = opts.metadatakey || 'tags'; // TODO: repurpose this key, make it the global bucket. other tags will live in it
  opts.sortBy = opts.sortBy || 'title';
  opts.reverse = opts.reverse || false;
  opts.slug = opts.slug || {mode: 'rfc3986'};

  // TODO: these functions don't need to be closures...
  return function(files, metalsmith, done) {


    /**
     * Get a safe tag
     * @param {string} a tag name
     * @return {string} safe tag
     */
    function safeTag(tag) {
      if (typeof opts.slug === 'function') {
        return opts.slug(tag);
      }

      return slug(tag, opts.slug);
    }

    /**
     * Sort tags by property given in opts.sortBy.
     * @param {Object} a Post object.
     * @param {Object} b Post object.
     * @return {number} sort value.
     */
    function sortBy(a, b) {
      a = a[opts.sortBy];
      b = b[opts.sortBy];
      if (!a && !b) {
        return 0;
      }
      if (!a) {
        return -1;
      }
      if (!b) {
        return 1;
      }
      if (b > a) {
        return -1;
      }
      if (a > b) {
        return 1;
      }
      return 0;
    }



    function getFilePath(path, opts) {
      return path
        .replace(/:num/g, opts.num)
        .replace(/:tag/g, safeTag(opts.tag));
    }

    // Find all tags and their associated files.
    // Using a for-loop so we don't incur the cost of creating a large array
    // of file names that we use to loop over the files object.
    for (var fileName in files) {
      var data = files[fileName];
      if (!data) {
        continue;
      }

      var tagsData = data[opts.handle];

      // If we have tag data for this file then turn it into an array of
      // individual tags where each tag has been sanitized.
      if (tagsData) {
        // Convert data into array.
        if (typeof tagsData === 'string') {
          tagsData = tagsData.split(',');
        }

        // Re-initialize tag array.
        data[opts.handle] = [];

        tagsData.forEach(function(rawTag) {
          // Trim leading + trailing white space from tag.
          var tag = String(rawTag).trim();


          // Save url safe formatted and display versions of tag data
          data[opts.handle].push({ name: tag, slug: safeTag(tag)});

          // Add each tag to our overall tagList and initialize array if it
          // doesn't exist.
          if (!tagList[tag]) {
            tagList[tag] = [];
          }

          // Store a reference to where the file data exists to reduce our
          // overhead.
          tagList[tag].push(fileName);
        });
      }
    }

    // Add to metalsmith.metadata for access outside of the tag files.
    var metadata = metalsmith.metadata();
    metadata[opts.metadatakey] = metadata[opts.metadatakey] || {};

    for (var tag in tagList) {
      // Map the array of tagList names back to the actual data object.
      // Sort tags via opts.sortBy property value.
      var posts = tagList[tag].map(function(fileName) {
        return files[fileName];
      }).sort(sortBy);

      // Reverse posts if desired.
      if (opts.reverse) {
        posts.reverse();
      }

      metadata[opts.metadatakey][tag] = posts;
      metadata[opts.metadatakey][tag].urlSafe = safeTag(tag);
    };

    // update metadata
    metalsmith.metadata(metadata);

    setImmediate(done);
  };
};
/**
 * Expose `plugin`.
 */
module.exports = plugin;
