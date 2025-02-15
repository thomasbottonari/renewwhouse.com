require([ "../lib/jquery-2.1.4",
    "mainNav",
    "../lib/photoswipe.min",
    "../lib/photoswipe-ui-default.min",
    "../lib/imagesloaded.pkgd.min",
    "../lib/masonry.pkgd.min",
    "./buildConfig"
  ], function( jquery, mainNav, PhotoSwipe, PhotoSwipeUI_Default, imagesLoaded, Masonry, buildConfig) {

  // require jquery-bridget, it's included in masonry.pkgd.js
  require( [ 'jquery-bridget/jquery.bridget' ],
  function() {

    var gallery = document.getElementById("gallery");
    var results = window.location.href.match(/gallery-(.*).html/);
    var context = (results && results.length >= 2) ? results[1] : 'exterior';

    var scriptUrl = (buildConfig.debug) ? "http://localhost/php/getPhotoList.php?directory=../images/gallery/" + context
      : "php/getPhotoList.php?directory=../images/gallery/" + context;
    $.ajax({
      url: scriptUrl,
      success: function(response) {
        var photoArray = JSON.parse(response).filter(function(file) {
          return (file.toLowerCase().endsWith('jpg')
            || file.toLowerCase().endsWith('jpeg')
            || file.toLowerCase().endsWith('png'));
        });
        photoArray.forEach(function(fileName, index) {
          var regex = /\d*x\d*/;
          var dims = fileName.match(regex)[0];
          var width = dims.split('x')[0];
          var height = dims.split('x')[1];
          var probability = $(document.getElementsByClassName('grid-sizer')).width()
            === 150 ? 20 : 9;
          var randomNum = Math.floor(Math.random() * (probability)) + 1;
          var isLarge = (width/height > 1) ? ((index+1) % randomNum === 0) : false;

          var figure = document.createElement('figure');
          var attr = document.createAttribute('class');
          attr.value = (isLarge) ? 'thumbnail large' : 'thumbnail';
          // if (width / height < 1) {
          //   attr.value = 'thumbnail portrait';
          // }
          figure.setAttributeNode(attr);

          var anchor = document.createElement('a');
          attr = document.createAttribute('href');
          attr.value = 'images/gallery/' + context + '/' + fileName;
          anchor.setAttributeNode(attr);
          attr = document.createAttribute('medium');
          attr.value = 'images/gallery/' + context + '/medium/' + fileName;
          anchor.setAttributeNode(attr);
          attr = document.createAttribute('med-size');
          attr.value = '1024x'+Math.round(1024/(width/height));
          anchor.setAttributeNode(attr);
          attr = document.createAttribute('data-size');
          attr.value = dims;
          anchor.setAttributeNode(attr);
          figure.appendChild(anchor);

          var image = document.createElement('img');
          attr = document.createAttribute('src');
          var suffix = (isLarge) ? '_large/' : '_small/';
          attr.value = 'images/gallery/' + context + '/thumb' + suffix + fileName;
          image.setAttributeNode(attr);
          anchor.appendChild(image);

          gallery.appendChild(figure);
        });

        // make Masonry a jQuery plugin
        $.bridget( 'masonry', Masonry );
        var $container = $('#gallery');

        imagesLoaded($container, function(){
          $container.masonry({
            itemSelector : '.thumbnail',
            columnWidth : '.grid-sizer',
            isFitWidth: true,
            gutter: 4
          });
        });

        initPhotoSwipeFromDOM('.my-gallery');
      },
      error: function(err) {
          throw new Error(err);
      }
    });

    var initPhotoSwipeFromDOM = function(gallerySelector) {

      // parse slide data (url, title, size ...) from DOM elements
      // (children of gallerySelector)
      var parseThumbnailElements = function(el) {
        var thumbElements = el.childNodes,
          numNodes = thumbElements.length,
          items = [],
          figureEl,
          linkEl,
          size,
          item;

        for(var i = 0; i < numNodes; i++) {

          figureEl = thumbElements[i]; // <figure> element

          // include only element nodes
          if(figureEl.nodeType !== 1 || figureEl.className === 'grid-sizer') {
            continue;
          }

          linkEl = figureEl.children[0]; // <a> element

          size = linkEl.getAttribute('data-size').split('x');
          var medSize = [0,0];
          if (linkEl.getAttribute('med-size')) {
            medSize = linkEl.getAttribute('med-size').split('x');
          }

          // create slide object
          item = {
            originalImage: {
              src: linkEl.getAttribute('href'),
              w: parseInt(size[0], 10),
              h: parseInt(size[1], 10)
            },
            mediumImage: {
              src: linkEl.getAttribute('medium'),
              w: parseInt(medSize[0], 10),
              h: parseInt(medSize[1], 10)
            }
          };



          if(figureEl.children.length > 1) {
            // <figcaption> content
            item.title = figureEl.children[1].innerHTML;
          }

          if(linkEl.children.length > 0) {
            // <img> thumbnail element, retrieving thumbnail url
            item.msrc = linkEl.children[0].getAttribute('src');
          }

          item.el = figureEl; // save link to element for getThumbBoundsFn
          items.push(item);
        }

        return items;
      };

      // find nearest parent element
      var closest = function closest(el, fn) {
        return el && ( fn(el) ? el : closest(el.parentNode, fn) );
      };

      // triggers when user clicks on thumbnail
      var onThumbnailsClick = function(e) {
        e = e || window.event;
        e.preventDefault ? e.preventDefault() : e.returnValue = false;

        var eTarget = e.target || e.srcElement;

        // find root element of slide
        var clickedListItem = closest(eTarget, function(el) {
          return (el.tagName && el.tagName.toUpperCase() === 'FIGURE');
        });

        if(!clickedListItem) {
          return;
        }

        // find index of clicked item by looping through all child nodes
        // alternatively, you may define index via data- attribute
        var clickedGallery = clickedListItem.parentNode,
          childNodes = clickedListItem.parentNode.childNodes,
          numChildNodes = childNodes.length,
          nodeIndex = 0,
          index;

        for (var i = 0; i < numChildNodes; i++) {
          if(childNodes[i].nodeType !== 1 || childNodes[i].className === 'grid-sizer') {
            continue;
          }

          if(childNodes[i] === clickedListItem) {
            index = nodeIndex;
            break;
          }
          nodeIndex++;
        }



        if(index >= 0) {
          // open PhotoSwipe if valid index found
          openPhotoSwipe( index, clickedGallery );
        }
        return false;
      };

      // parse picture index and gallery index from URL (#&pid=1&gid=2)
      var photoswipeParseHash = function() {
        var hash = window.location.hash.substring(1),
        params = {};

        if(hash.length < 5) {
          return params;
        }

        var vars = hash.split('&');
        for (var i = 0; i < vars.length; i++) {
          if(!vars[i]) {
            continue;
          }
          var pair = vars[i].split('=');
          if(pair.length < 2) {
            continue;
          }
          params[pair[0]] = pair[1];
        }

        if(params.gid) {
          params.gid = parseInt(params.gid, 10);
        }

        return params;
      };

      var openPhotoSwipe = function(index, galleryElement, disableAnimation, fromURL) {
        var pswpElement = document.querySelectorAll('.pswp')[0],
          gallery,
          options,
          items;

        items = parseThumbnailElements(galleryElement);

        // define options (if needed)
        options = {

          // define gallery index (for URL)
          galleryUID: galleryElement.getAttribute('data-pswp-uid'),

          getThumbBoundsFn: function(index) {
            // See Options -> getThumbBoundsFn section of documentation for more info
            var thumbnail = items[index].el.getElementsByTagName('img')[0], // find thumbnail
              pageYScroll = window.pageYOffset || document.documentElement.scrollTop,
              rect = thumbnail.getBoundingClientRect();

            return {x:rect.left, y:rect.top + pageYScroll, w:rect.width};
          }

        };

        // PhotoSwipe opened from URL
        if(fromURL) {
          if(options.galleryPIDs) {
            // parse real index when custom PIDs are used
            // http://photoswipe.com/documentation/faq.html#custom-pid-in-url
            for(var j = 0; j < items.length; j++) {
              if(items[j].pid == index) {
                options.index = j;
                break;
              }
            }
          } else {
            // in URL indexes start from 1
            options.index = parseInt(index, 10) - 1;
          }
        } else {
          options.index = parseInt(index, 10);
        }

        // exit if index not found
        if( isNaN(options.index) ) {
          return;
        }

        if(disableAnimation) {
          options.showAnimationDuration = 0;
        }

        // initialise as usual
        var gallery = new PhotoSwipe( pswpElement, PhotoSwipeUI_Default, items, options);

        // create variable that will store real size of viewport
        var realViewportWidth,
            useLargeImages = false,
            firstResize = true,
            imageSrcWillChange;

        // beforeResize event fires each time size of gallery viewport updates
        gallery.listen('beforeResize', function() {
            // gallery.viewportSize.x - width of PhotoSwipe viewport
            // gallery.viewportSize.y - height of PhotoSwipe viewport
            // window.devicePixelRatio - ratio between physical pixels and device independent pixels (Number)
            //                          1 (regular display), 2 (@2x, retina) ...


            // calculate real pixels when size changes
            realViewportWidth = gallery.viewportSize.x * window.devicePixelRatio;

            // Code below is needed if you want image to switch dynamically on window.resize

            // Find out if current images need to be changed
            if(useLargeImages && realViewportWidth < 1000) {
                useLargeImages = false;
                imageSrcWillChange = true;
            } else if(!useLargeImages && realViewportWidth >= 1000) {
                useLargeImages = true;
                imageSrcWillChange = true;
            }

            // Invalidate items only when source is changed and when it's not the first update
            if(imageSrcWillChange && !firstResize) {
                // invalidateCurrItems sets a flag on slides that are in DOM,
                // which will force update of content (image) on window.resize.
                gallery.invalidateCurrItems();
            }

            if(firstResize) {
                firstResize = false;
            }

            imageSrcWillChange = false;

        });


        // gettingData event fires each time PhotoSwipe retrieves image source & size
        gallery.listen('gettingData', function(index, item) {

            // Set image source & size based on real viewport width
            // if( useLargeImages ) {
            if (false) {
                item.src = item.originalImage.src;
                item.w = item.originalImage.w;
                item.h = item.originalImage.h;
            } else {
                item.src = item.mediumImage.src;
                item.w = item.mediumImage.w;
                item.h = item.mediumImage.h;
            }

            // It doesn't really matter what will you do here,
            // as long as item.src, item.w and item.h have valid values.
            //
            // Just avoid http requests in this listener, as it fires quite often

        });


        // Note that init() method is called after gettingData event is bound
        gallery.init();
      };

      // loop through all gallery elements and bind events
      var galleryElements = document.querySelectorAll( gallerySelector );

      for(var i = 0, l = galleryElements.length; i < l; i++) {
        galleryElements[i].setAttribute('data-pswp-uid', i+1);
        galleryElements[i].onclick = onThumbnailsClick;
      }

      // Parse URL and open gallery if it contains #&pid=3&gid=1
      var hashData = photoswipeParseHash();
      if(hashData.pid && hashData.gid) {
        openPhotoSwipe( hashData.pid ,  galleryElements[ hashData.gid - 1 ], true, true );
      }
    };
  });
});
