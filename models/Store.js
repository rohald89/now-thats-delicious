const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const slug = require('slugs');

const storeSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true,
        required: "Please enter a store name!"
    },
    slug: String,
    description: {
        type: String,
        trim: true,
    },
    tags: [String],
    created: {
        type: Date,
        default: Date.now(),
    },
    location: {
        type: {
            type: String,
            default: 'Point'
        },
        coordinates: [{
            type: Number,
            required: "You must supply coordinates!"
        }],
        address: {
            type: String,
            required: "You must supply an address!"
        }
    },
    photo: String
});

storeSchema.pre('save', async function(next) {
    if(!this.isModified('name')){
        next(); //skip it
        return; // stop this function from running
    }
    this.slug = slug(this.name);
    // find other stores that have a slug with that name and add a number after it
    const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, 'i');
    const storesWithSlug = await this.constructor.find({ slug: slugRegEx })
    if(storesWithSlug.length) {
        this.slug = `${this.slug}-${storesWithSlug.length + 1}`;
    }
    next();
    //TODO make more resiliant so slugs are unique
});

storeSchema.pre('findOneAndUpdate', async function(next){
    //convert query into currently existing document
    const docToUpdate = await this.model.findOne(this.getQuery());
    //check query's name vs doc's name
    if(this._update.name === docToUpdate.name) return next();
    //run all the regular code, just with this._update to intercept the query being performed, and then this.model instead of this.constructor
    this._update.slug = slug(this._update.name);
    const slugRegEx = new RegExp(`^(${this._update.slug})((-[0-9]*$)?)$`, 'i');
    const storesWithSlug = await this.model.find({ slug: slugRegEx });
    if(storesWithSlug.length){
      this._update.slug = `${this._update.slug}-${storesWithSlug.length+1}`
    }
    next();
});


storeSchema.statics.getTagsList = function() {
    return this.aggregate([
        // Video 21: Custom MongoDB Aggregations 
        { $unwind: '$tags'}, // unwind based on tags. If a store had 3 different tags it'll show up 3 times (1 time for every single tag)
        { $group: { _id: '$tags', count: { $sum: 1 }}}, // group those stores together if they have the same tag. result will be an object with an _id: <TAGNAME>. count is the number of restaurants that have that specific tag.
        { $sort: { count: -1 }} // sort the results on the value of <COUNT> give it value 1 for Ascending list and -1 for Descending
    ]);
};

module.exports = mongoose.model('Store', storeSchema);