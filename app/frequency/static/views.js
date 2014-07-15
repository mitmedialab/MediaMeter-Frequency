
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
            var view = this.getResultView(m);
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
        this.listenTo(this.model.get('results').get('wordcounts'), 'request', function () {
            App.debug('Model Request');
            this.$('.content-text').show();
            this.$('.content-viz').hide();
        });
        this.listenTo(
            this.model.get('results')
            , 'sync'
            , function () {
                App.debug('App.FrequencyResultView:sync:' + this.cid);
                var view = new App.WordCountResultView({
                    collection: this.model.get('results').get('wordcounts')
                });
                this.listenTo(view, 'mm:refine', function (options) {
                    this.model.refine.trigger('mm:refine', {
                        term: options.term
                        , queryCid: this.model.cid
                    });
                });
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
        sizeRange: { min: 10, max: 36 }
        , height: 400
        , padding: 10
        , linkColor: "#428bca"
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
        var that = this;
        this.updateStats();
        this.$el.html(this.template());
        this.$('.content-text').hide();
        _.defer(function () { that.renderSvg(); });
    },
    sizeRange: function () {
        return _.clone(this.config.sizeRange);
    },
    fontSize: function (term, extent, sizeRange) {
        if (typeof(sizeRange) === 'undefined') {
            sizeRange = this.sizeRange();
        }
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
    },
    renderSvg: function () {
        var that = this;
        var container = d3.select(this.el).select('.content-viz');
        var width = this.$('.content-viz').width();
        var innerWidth = width/3.0 - 2*this.config.padding;
        var svg = container.append('svg')
            .attr('height', this.config.height)
            .attr('width', width);
        var leftGroup = svg.append('g').classed('left-group', true)
            .attr('transform', 'translate('+this.config.padding+')');
        var intersectGroup = svg.append('g').classed('intersect-group', true)
            .attr('transform', 'translate('+(innerWidth+this.config.padding)+')');
        var rightGroup = svg.append('g').classed('right-group', true)
            .attr('transform', 'translate('+(2.0*innerWidth+this.config.padding)+')');
        var y = this.config.height;
        var sizeRange = this.sizeRange();
        var leftWords, rightWords, intersectWords;
        while (y >= this.config.height && sizeRange.max > sizeRange.min) {
            // Create words
            leftWords = leftGroup.selectAll('.word')
                .data(this.left, function (d) { return d.stem; });
            leftWords.enter()
                .append('text').classed('word', true).classed('left', true)
                .attr('font-size', function (d) {
                    return that.fontSize(d, that.leftExtent, sizeRange); });
            rightWords = rightGroup.selectAll('.word')
                .data(this.right, function (d) { return d.stem; });
            rightWords.enter()
                .append('text').classed('word', true).classed('right', true)
                .attr('font-size', function (d) {
                    return that.fontSize(d, that.rightExtent, sizeRange); });
            intersectWords = intersectGroup.selectAll('.word')
                .data(this.center, function (d) { return d.stem; });
            intersectWords.enter()
                .append('text').classed('word', true).classed('intersect', true)
                .attr('font-size', function (d) {
                    return that.fontSize(d, that.centerExtent, sizeRange); });
            d3.selectAll('.word')
                .text(function (d) { return d.term; })
                .attr('font-weight', 'bold');
            d3.selectAll('.left.word')
                .attr('fill', App.config.queryColors[0]);
            d3.selectAll('.right.word')
                .attr('fill', App.config.queryColors[1]);
            // Layout
            y = 0;
            y = Math.max(y, this.listCloudLayout(leftWords, innerWidth, this.leftExtent, sizeRange));
            y = Math.max(y, this.listCloudLayout(intersectWords, innerWidth, this.centerExtent, sizeRange));
            y = Math.max(y, this.listCloudLayout(rightWords, innerWidth, this.rightExtent, sizeRange));
            sizeRange.max = sizeRange.max - 1;
        }
        d3.selectAll('.word')
            .on('mouseover', function () {
                d3.select(this).attr('fill', that.config.linkColor);
            })
            .on('mouseout', function () {
                var color = '#000';
                if (d3.select(this).classed('left')) {
                    color = App.config.queryColors[0];
                }
                if (d3.select(this).classed('right')) {
                    color = App.config.queryColors[1];
                }
                d3.select(this).attr('fill', color);
            });
        d3.selectAll('.left.word')
            .on('click', function (d) {
                that.collection.refine.trigger('mm:refine', {
                    term: d.term
                    , query: 0
                });
            });
        d3.selectAll('.right.word')
            .on('click', function (d) {
                that.collection.refine.trigger('mm:refine', {
                    term: d.term
                    , query: 1
                });
            });
        d3.selectAll('.intersect.word')
            .on('click', function (d) {
                that.collection.refine.trigger('mm:refine', {
                    term: d.term
                    , query: 1
                });
            });
    },
    listCloudLayout: function (words, width, extent, sizeRange) {
        var that = this;
        var x = 0;
        words.attr('x', function (d) {
            var textLength = this.getComputedTextLength();
            var fs = that.fontSize(d, extent, sizeRange);
            var lastX = x;
            if (x + textLength + that.config.padding > width) {
                lastX = 0;
            }
            x = lastX + textLength + 0.3*fs;
            return lastX;
        });
        var y = 0;
        var lastAdded = 0;
        words.attr('y', function (d) {
            if (d3.select(this).attr('x') == 0) {
                y += 1.5 * that.fontSize(d, extent, sizeRange);
                lastAdded = 1.5 * that.fontSize(d, extent, sizeRange);
            }
            return y;
        });
        return y + lastAdded;
    }
});
