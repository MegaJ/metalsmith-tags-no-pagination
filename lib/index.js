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
  opts.topLevelBucket = opts.topLevelBucket || "paginationReadyTags";
  // only interpolate :tag TODO: don't hard code interpolation for :tag. Also, warn user that they should leave in :num
  // to be interpolated by metalsmith-pagination
  opts.path = opts.pathPage || opts.path || 'tags/:tag/:num/index.html';
  opts.perPage  = opts.perPage || 10;
  opts.layout = opts.layout || 'partials/tag.hbt'; // TODO: I think an error should be thrown 
  opts.handle = opts.handle || 'tags';
  opts.pageMetadata = opts.pageMetadata || {}; // should mirror metalsmith-collections functionality by the same name
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


    // Interpolate :tag only instead of both :tag and :num. :num is handled by msPagination
    function getFilePath(path, opts) {
      return path
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
    // Example structure, excerpted from metalsmith object: {_metadata: {opts.metadatakey: {tag1: [], tag2: []  }}}
    var metadata = metalsmith.metadata();
    let topLevelBucket = (metadata[opts.topLevelBucket] = metadata[opts.topLevelBucket] || {});

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

      // opts.metadatakey acts as a name for a selection of tags (name it category for example) (note the careful wording)
      topLevelBucket[opts.metadatakey] = topLevelBucket[opts.metadatakey] || {};

      if (topLevelBucket[opts.metadatakey][tag]) {
        console.log("Warning! metadata in ",
                    opts.topLevelBucket + "[" + opts.metadatakey + "]" + "[" + tag + "]",
                    " is already set! Continuing...");
      }

      topLevelBucket[opts.metadatakey][tag] = posts;
      let selection = topLevelBucket[opts.metadatakey][tag];
      selection.urlSafe = safeTag(tag);

      // see https://github.com/blakeembrey/metalsmith-pagination/blob/master/metalsmith-pagination.js#L102
      // for noting which properties will be set in the pagination object.
      // we try to have options with the same name, so they can integrate easy in someone's own customization layer
      // not all are implemented, only ones for my own use case
      selection.path = getFilePath(opts.path, {tag: tag});
      selection.perPage = opts.perPage;
      selection.layout = opts.layout;
      selection.pageMetadata = opts.pageMetadata;
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
