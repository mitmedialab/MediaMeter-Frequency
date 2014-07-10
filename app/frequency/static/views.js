
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
