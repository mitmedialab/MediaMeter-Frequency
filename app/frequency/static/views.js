
App.FrequencyResultListView = App.NestedView.extend({
    initialize: function (options) {
        App.debug('App.FrequencyResultListView.initialize()');
        this.resultViews = {};
        this.render();
    },
    render: function () {
        App.debug('App.FrequencyResultListView.render()');
        this.$el.html('');
        this.collection.each(function (m) {
            var view = this.getResultView(m.get('results'));
            this.$el.append(view.el);
        }, this);
        this.listenTo(
            this.collection.resources
            , 'resource:complete:wordcount'
            , function () {
                if (this.collection.length < 2) {
                    return;
                }
                if (this.comparisonView) {
                    this.comparisonView.remove();
                }
                this.comparisonView = new App.FrequencyResultComparisonView({
                    collection: this.collection
                });
                this.$el.append(this.comparisonView.el);
            }
        );
    },
    // Return a unique and reusable view for a ResultModel
    getResultView: function (m) {
        if (this.resultViews[m.cid]) {
            return this.resultViews[m.cid];
        }
        var view = new App.FrequencyResultView({ model: m });
        this.resultViews[m.cid] = view;
        return view;
    }
});

App.FrequencyResultView = Backbone.View.extend({
    template: _.template($('#tpl-frequency-result-view').html()),
    initialize: function (options) {
        App.debug('App.FrequencyResultView.initialize()');
        this.render();
    },
    render: function () {
        App.debug('App.FrequencyResultView.render()');
        this.$el.html(this.template());
        var progress = _.template($('#tpl-progress').html())();
        this.$('.content-text').html(progress);
        this.listenTo(this.model.get('wordcounts'), 'request', function () {
            App.debug('Model Request');
            this.$('.content-text').show();
            this.$('.content-viz').hide();
        });
        this.listenTo(
            this.model
            , 'sync'
            , function () {
                App.debug('App.FrequencyResultView:sync:' + this.cid);
                var view = new App.WordCountResultView({collection:this.model.get('wordcounts')});
                this.$('.content-viz').html(view.el);
                this.$('.content-viz').show();
                this.$('.content-text').hide();
            }
        );
    }
});

App.FrequencyResultComparisonView = Backbone.View.extend({
    config: {
        // Use sizeRange() to read, might be dynamic in the future
        sizeRange: { min: 10, max: 48 }
    },
    template: _.template($('#tpl-frequency-result-comparison-view').html()),
    initialize: function (options) {
        this.render();
    },
    updateStats: function () {
        var allLeft = this.collection.at(0).get('results').get('wordcounts').toJSON();
        var allRight = this.collection.at(1).get('results').get('wordcounts').toJSON();
        var countSel = function (d) { return d.count };
        var leftSum = d3.sum(allLeft, countSel);
        var rightSum = d3.sum(allRight, countSel);
        var topLeft = _.first(allLeft, 100);
        var topRight = _.first(allRight, 100);
        // Normalize
        _.each(topLeft, function (d) {
            d.tfnorm = d.count / leftSum;
        });
        _.each(topRight, function (d) {
            d.tfnorm = d.count / rightSum;
        })
        // Find L - R, L int R, R - L
        var terms = {}
        _.each(topLeft, function (d) {
            terms[d.stem] = d;
            terms[d.stem].left = true;
        });
        _.each(topRight, function (d) {
            if (!terms[d.stem]) {
                terms[d.stem] = d;
            } else {
                terms[d.stem].tfnorm = (terms[d.stem].count + d.count) / (leftSum + rightSum);
            }
            terms[d.stem].right = true;
        });
        this.left = _.filter(terms, function (d) { return d.left && !d.right; });
        this.right = _.filter(terms, function (d) { return d.right && !d.left; });
        this.center = _.filter(terms, function (d) { return d.left && d.right; });
        this.center.sort(function (a, b) {
            return b.tfnorm - a.tfnorm;
        });
        this.leftExtent = d3.extent(this.left, function (d) { return d.tfnorm; });
        this.rightExtent = d3.extent(this.right, function (d) { return d.tfnorm; });
        this.centerExtent = d3.extent(this.center, function (d) { return d.tfnorm; })
    },
    render: function () {
        this.updateStats();
        this.$el.html(this.template());
        this.renderHtml();
    },
    sizeRange: function () {
        return this.config.sizeRange;
    },
    fontSize: function (term, extent) {
        var sizeRange = this.sizeRange();
        var size = sizeRange.min
            + (sizeRange.max - sizeRange.min)
                * ( Math.log(term.tfnorm) - Math.log(extent[0]) )
                / ( Math.log(extent[1]) - Math.log(extent[0]) );
        return size;
    },
    renderHtml: function () {
        var that = this;
        var container = d3.select(this.el).select('.content-text');
        container.append('h3').text('Main');
        container.append('div').selectAll('.left')
            .data(this.left, function (d) { return d.stem; })
            .enter()
                .append('span').classed('left', true)
                .style('font-size', function (d) {
                    return that.fontSize(d, that.leftExtent) + 'px';
                })
                .style('font-weight', 'bold')
                .text(function (d) { return d.term + ' '; });
        container.append('h3').text('Intersection');
        container.append('div').selectAll('.intersection')
            .data(this.center, function (d) { return d.stem; })
            .enter()
                .append('span').classed('intersection', true)
                .style('font-size', function (d) {
                    return that.fontSize(d, that.centerExtent) + 'px';
                })
                .style('font-weight', 'bold')
                .text(function (d) { return d.term + ' '; });
        container.append('h3').text('Comparison');
        container.append('div').selectAll('.right')
            .data(this.right, function (d) { return d.stem; })
            .enter()
                .append('span').classed('right', true)
                .style('font-size', function (d) {
                    return that.fontSize(d, that.rightExtent) + 'px';
                })
                .style('font-weight', 'bold')
                .text(function (d) { return d.term + ' '; });
    }
});
