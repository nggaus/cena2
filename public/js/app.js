var app = angular.module("Cena", ['ui.bootstrap', 'ngRoute']);

// angular routing
app.config(['$routeProvider',
  function($routeProvider) {
    $routeProvider.
      when('/lists', {
        templateUrl: 'views/lists.html',
        controller: 'ListController'
      }).
      when('/addlist', {
        templateUrl: 'views/addlist.html',
        controller: 'ListController'
      }).
      when('/addlist/:type', {
        templateUrl: 'views/addlist.html',
        controller: 'ListController'
      }).
      when('/lists/:list', {
        templateUrl: 'views/lists.html',
        controller: 'ListController'
      }).
      when('/foodstuffs', {
        templateUrl: 'views/foodstuff.html',
        controller: 'ListController'
      }).
      when('/addfoodstuff', {
        templateUrl: 'views/addlist.html',
        controller: 'ListController'
      }).
      when('/foodstuffs/:list', {
        templateUrl: 'views/lists.html',
        controller: 'ListController'
      }).
      when('/readme', {
        templateUrl: 'views/readme.html'
      }).
      otherwise({
        redirectTo: '/lists'
      });
  }
]);

// reverse filter (reverse the displayed list)
app.filter('reverse', function() {
  return function(items) {
    if (typeof items == "object") {
      return items.slice().reverse();
    } else return [];
  };
});

app.controller("ListController", function($scope, $routeParams, ListService, FoodStuffService, $rootScope, $location) {
  var root = $scope;

  // place to store incoming list data
  root.newList = {
    pretags: $routeParams.type || ""
  };
  root.printableList = {};

  // search string for list
  root.listSearchString = "";

  ListService.get(function(all) {
    root.lists = all;

    // get lists to display
    root.DispLists = _.filter(root.lists, function(list) {
      return list.name == $routeParams.list;
    });

    // if we got nothing, display all
    if (root.DispLists.length === 0) root.DispLists = all;

    // next, the foodstuffs
    // root.foodstuffs = [
    //   {
    //     name: "Bread",
    //     price: 5.50,
    //     tags: ["abc"]
    //   },
    //   {
    //     name: "Milk",
    //     price: 1.00,
    //     tags: ["abc"]
    //   },
    //   {
    //     name: "Cheese",
    //     price: 0.24,
    //     tags: ["abc"]
    //   }
    // ];
    FoodStuffService.get(function(all) {
      root.foodstuffs = all;
    });

    root.doPrintableList();
  });

  // return all lists that have the specified tag included
  root.getListsByTag = function(lists, tag) {
    // if tag is set, look for everything with that tag
    // otherwise, get everthing that isn't a tag
      out = _.filter(lists, function(l) {
        if (tag) {
          return l.tags.indexOf(tag) !== -1;
        } else {
          return l.tags.indexOf("grocery") === -1 && l.tags.indexOf("recipe") === -1;
        }
      });


    // if it's a grocery list, with hopefully a date in the name
    if (tag === "grocery") {
      // sort all grocery lists
      out = _.sortBy(out, function(n) {
        // find dates by regex
        dates = n.name.match(/[\d]{1,2}[\.\/-]?[\d]{1,2}[\.\/-]?[\d]{2,4}?/gi);
        if (dates && dates.length) {
          // format the regex output into a date,
          // and get the timestamp to compare
          preDate = dates[0].split(/[\.\/-]/gi);
          if (preDate.length < 1) preDate = dates[0].match(/[.]{2}/gi);
          return new Date(preDate.join("/")).getTime()
        };
      }).reverse();
    };

    return out;
  };

  // list fuzzy searching
  root.matchesSearchString = function(list, filter) {
    // if there's no filter, return true
    if (!filter) return true;

    // make filter lowercase
    filter = filter.toLowerCase();

    // create a corpus of the important parts of each list item
    corpus = _.compact(_.map(["name", "desc", "tags"], function(key) {
      return JSON.stringify(list[key]);
    }).join(" ").toLowerCase().split(/[ ,\[\]"-]/gi));

    // how many matching words are there between the corpus
    // and the filter string?
    score = _.intersection(
      corpus,
      filter.split(' ')
    ).length;

    // console.log(list.name, score);
    // console.log(corpus, filter.split(' '))
    return score > 0;
  };

  // add new list
  root.addList = function(list) {
    // tags
    list.tags = list.tags || (list.pretags && list.pretags.split(" "));
    ListService.add(list, function(data) {

      // update all list instances
      ListService.get(function(all) {
        $rootScope.$emit("listUpdate", all);
        $location.url("/lists");
      });

    });
  };

  // delete list
  root.delList = function(list) {
    ListService.remove({name: list.name}, function(data) {
      // update all list instances
      ListService.get(function(all) {
        root.lists = data;
        $rootScope.$emit("listUpdate", all);
      });
    });
  };

  // add a new item to list
  root.addToList = function(list, item) {
    _.each(_.filter(root.lists, function(l) {
      return l.name == list.name;
    }), function(list) {

      // find the item we want
      fs = _.filter(root.getTypeahead(list), function(s) {
        return s.name == item;
      });

      // update each list
      _.each(fs, function(f) {

        // make sure these are set
        if (!f.contents) f.price = f.price || '0.00';
        f.amt = f.amt || 1;
        f.checked = false;

        // add to list
        list.contents.push(
          $.extend(true, {}, f)
        );
      });

      // lastly, update the backend
      ListService.update(list);
    });
  };

  // delete a new item from list
  root.delFromList = function(list, item) {
    _.each(_.filter(root.lists, function(l) {
      return l.name == list.name;
    }), function(list) {

      // find the foodstuff we want
      fs = _.filter(list.contents, function(s) {
        return s.name == item;
      });

      // update each list
      _.each(fs, function(f) {
        list.contents.splice( list.contents.indexOf(f), 1 );
      });

      // lastly, update the backend
      ListService.update(list);
    });
  };

  // force a list update
  root.updateList = function(list) {
    ListService.update(list);
  };

  // get items for typeahead
  root.getTypeahead = function(list) {
    return _.union(root.foodstuffs,
      _.filter(root.lists, function(lst) {
        return lst.name !== list.name;
      })
    );
  };

  // get total stuff about list
  root.totalList = function(list) {
    totalPrice = _.reduce(list.contents, function(prev, l) {
      if (l.contents) {
        return prev + l.amt * root.totalList(l).price;
      } else {
        return prev + l.amt * parseFloat(l.price);
      };
    }, 0);

    return {price: totalPrice}
  };

  // extract all items from a list
  // and turn it into 1 big list
  root.deItemizeList = function(list) {
    return _.flatten(_.map(list.contents, function(l) {
      if (l.contents) {
        return root.deItemizeList(l);
      } else {
        return l;
      };
    }));
  };

  root.sortByTag = function(list) {
    // flatten the list
    flatList = root.deItemizeList(list);

    // sort the list
    return _.groupBy(flatList, function(n) {

      // sort by sort tags that are present
      return _.filter(n.tags, function(t) {
        return t.indexOf("sort-") === 0;
      }).join(" ") || "Unsorted";

    });
  };

  root.doPrintableList = function() {
    _.each(root.lists, function(l) {
      root.printableList[l.name] = root.sortByTag(l);
      // console.log(root.printableList);
    });
  };

  // add the tag, and delimit it with spaces
  root.addTagToNewList = function(tag) {
    root.newList.pretags = (root.newList.pretags || "") + " " + tag;
    root.newList.pretags = root.newList.pretags.trim()
    $("input#list-tags").focus();
  };

  // update all list instances
  $rootScope.$on("listUpdate", function(status, data) {
    root.lists = data;

    // get lists to display
    root.DispLists = _.filter(root.lists, function(list) {
      return list.name == $routeParams.list;
    });

    // if we got nothing, display all
    if (root.DispLists.length === 0) root.DispLists = data;

    // update printable list
    root.doPrintableList();
  });

  // update all foodstuff instances
  $rootScope.$on("fsUpdate", function(status, data) {
    root.foodstuffs = data;
  });

});

app.factory("ListService", function($http) {
  return {
    get: function(cb) {
      $http({
        method: "get",
        url: "/lists"
      }).success(function(data) {
        cb && cb(data.data);
      });
    },

    add: function(list, cb) {
      $http({
        method: "post",
        url: "/lists",
        data: angular.toJson(list)
      }).success(function(data) {
        cb && cb(data);
      });
    },

    remove: function(list, cb) {
      $http({
        method: "delete",
        url: "/lists/"+list.name,
        data: angular.toJson(list)
      }).success(function(data) {
        cb && cb(data);
      });
    },

    update: function(list, cb) {
      $http({
        method: "put",
        url: "/lists/"+list.name,
        data: angular.toJson(list)
      }).success(function(data) {
        cb && cb(data);
      });
    }
  };
});

app.controller("FsController", function($scope, $routeParams, FoodStuffService, $rootScope, $modal) {
  var root = $scope;

  // place to store incoming list data
  root.newFs = {};

  // foodstuff drawer
  root.foodstuffhidden = true

  FoodStuffService.get(function(all) {
    root.foodstuffs = all;
  });

  // add new list
  root.addFs = function(fs) {
    // tags
    fs.tags = fs.tags || fs.pretags.split(" ");

    // make sure $ amount doesn't start with a $
    if (fs.price[0] == "$") fs.price = fs.price.substr(1);

    FoodStuffService.add(fs, function(data) {

      // update all foodstuff instances
      FoodStuffService.get(function(all) {
        root.newFs = {};
        $rootScope.$emit("fsUpdate", all);
      });

    });
  };

  // add new list
  root.delFs = function(fs) {
    FoodStuffService.remove({name: fs.name}, function(data) {
      // update all foodstuff instances
      FoodStuffService.get(function(all) {
        $rootScope.$emit("fsUpdate", all);
      });
    });
  };

  // update a foodstuff price / tags
  root.modifyFs = function(list, pretags) {
    list.tags = pretags.split(" "); // format tags
    root.updateFs(list); // update list on backend
    $("#edit-foodstuff-"+list._id).modal('hide'); // close modal
  };

  // force a list update
  root.updateFs = function(list) {
    FoodStuffService.update(list);
  };

  // update all list instances
  $rootScope.$on("fsUpdate", function(status, data) {
    root.foodstuffs = data;
  });

  // add the tag, and delimit it with spaces
  root.addTagToNewFoodstuff = function(tag) {
    root.newFs.pretags = (root.newFs.pretags || "") + " " + tag;
    root.newFs.pretags = root.newFs.pretags.trim()
    $("input#fs-tags").focus();
  };

  // list fuzzy searching
  root.matchesSearchString = function(list, filter) {
    // if there's no filter, return true
    if (!filter) return true;

    // make filter lowercase
    filter = filter.toLowerCase();

    // create a corpus of the important parts of each list item
    corpus = _.compact(_.map(["name", "desc", "tags"], function(key) {
      return JSON.stringify(list[key]);
    }).join(" ").toLowerCase().split(/[ ,\[\]"-]/gi));

    // how many matching words are there between the corpus
    // and the filter string?
    score = _.intersection(
      corpus,
      filter.split(' ')
    ).length;

    // console.log(list.name, score);
    // console.log(corpus, filter.split(' '))
    return score > 0;
  };

});

app.factory("FoodStuffService", function($http) {
  return {
    get: function(cb) {
      $http({
        method: "get",
        url: "/foodstuffs"
      }).success(function(data) {
        cb && cb(data.data);
      });
    },

    add: function(list, cb) {
      $http({
        method: "post",
        url: "/foodstuffs",
        data: angular.toJson(list)
      }).success(function(data) {
        cb && cb(data);
      });
    },

    remove: function(list, cb) {
      $http({
        method: "delete",
        url: "/foodstuffs/"+list.name,
        data: angular.toJson(list)
      }).success(function(data) {
        cb && cb(data);
      });
    },

    update: function(list, cb) {
      $http({
        method: "put",
        url: "/foodstuffs/"+list.name,
        data: angular.toJson(list)
      }).success(function(data) {
        cb && cb(data);
      });
    }
  };
});
