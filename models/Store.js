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
    photo: String,
    author: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: 'You must supply an author'
    }
}, {
    toJSON: {virtuals: true },
    toObject: {virtuals: true } // thanks to these 2 lines the virtual property of `reviews` declared on line 97 will be added to the Object
});

// Define our indexes
storeSchema.index({
    name: 'text',
    description: 'text'
});

storeSchema.index({
    location: '2dsphere'
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
    return this.aggregate([  // aggregate is a query like find but you can do more complex / multiple step queries
        // Video 21: Custom MongoDB Aggregations 
        { $unwind: '$tags'}, // unwind based on tags. If a store had 3 different tags it'll show up 3 times (1 time for every single tag)
        { $group: { _id: '$tags', count: { $sum: 1 }}}, // group those stores together if they have the same tag. result will be an object with an _id: <TAGNAME>. count is the number of restaurants that have that specific tag.
        { $sort: { count: -1, _id: 1 }} // sort the results on the value of <COUNT> give it value 1 for Ascending list and -1 for Descending // added _id aswell so tags stay on the same place after selecting one. Now it sorts based on the number of stores but if they got the same number it'll take the id and sort that on alphabet
    ]);
};

storeSchema.statics.getTopStores = function() {
    return this.aggregate([   // lower level mongodb function that does not have access to the virtual properties added below this function!
        // Lookup Stores and populate their reviews
        { $lookup: { 
            from: 'reviews',  // get the data from the reviews
            localField: '_id',  // based on the id field on the store
            foreignField: 'store',  // hook it up to the store field in the reviews
            as: 'reviews' // name it reviews. This could be anything :)
        }},
        // filter for only items that have 2 or more reviews
        { $match: {
            'reviews.1': {  // check the reviews object created above
                $exists: true  // make sure that reviews[1] exists and therefor rule out all the stores that only got one or no reviews
            }
        }},
        // Add the average reviews field
        { $project: // add a field, using this will only leave you with the properties specifically added here so we had to add the photo, name and reviews back to it.
            {
                photo: `$$ROOT.photo`,
                name: `$$ROOT.name`,
                reviews: `$$ROOT.reviews`,
                slug: `$$ROOT.slug`,
                averageRating: { $avg: '$reviews.rating'} // call it `averageRating` and set it equal to the average of all reviews.rating 
            }
        },
        // sort it by our new field, highest reviews first
        {
            $sort: { 
                averageRating: -1 // Descending
            }
        },
        // limit to at most 10 results
        {
            $limit: 10
        }
    ]);
};

function autopopulate(next) {
    this.populate('reviews');
    next();
}

storeSchema.pre('find', autopopulate);
storeSchema.pre('findOne', autopopulate);

// find reviewws where the stores _id property === reviews store property
storeSchema.virtual('reviews', {
    ref: 'Review',  // what model to link 
    localField: '_id',  // which field on the store
    foreignField: 'store' // which field on the review
});
// Virtual fields don't automatically add to the object unless you specifically ask it to! Looking at a Store Object doesn't show it but looking at store.reviews will show all the reviews made for that store. 




module.exports = mongoose.model('Store', storeSchema);