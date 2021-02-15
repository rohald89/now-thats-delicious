const mongoose = require('mongoose');
const Store = mongoose.model('Store');
const User = mongoose.model('User');
const multer = require('multer');
const jimp = require('jimp');
const uuid = require('uuid');

const multerOptions = {
    storage: multer.memoryStorage(),
    fileFilter(req, file, next) {
        const isPhoto = file.mimetype.startsWith('image/');
        if(isPhoto) {
            next(null, true);
        } else {
            next({message: 'That filetype isn\'t allowed!'})
        }
    }
}

exports.homePage = (req, res) => {
    res.render('index');
};

exports.addStore = (req, res) => {
    res.render('editStore', { title: "Add Store"});
}

exports.upload = multer(multerOptions).single('photo');

exports.resize = async (req, res, next) => {
    // check if there is no new file to resize
    if(!req.file){
        next(); // skip to the next middleware
        return;
    } 
    const extension = req.file.mimetype.split('/')[1];
    req.body.photo = `${uuid.v4()}.${extension}`;
    // now we resize
    const photo = await jimp.read(req.file.buffer);
    await photo.resize(800, jimp.AUTO);
    await photo.write(`./public/uploads/${req.body.photo}`);
    // once we have written the photo to our filesystem, keep going
    next();
}

exports.createStore = async (req, res) => {
    req.body.author = req.user._id;
    const store = await (new Store(req.body)).save();
    req.flash('success', `Succesfully Created ${store.name}. Care to leave a review?`)
    res.redirect(`/store/${store.slug}`);
};

exports.getStores = async(req, res) => {
    const page = req.params.page || 1;
    const limit = 6; // per page
    const skip = (page * limit) - limit;  // get the start index

    // 1. Query the database for a list of all stores
    const storesPromise = Store
        .find()
        .skip(skip)
        .limit(limit)
        .sort({ created: 'desc' });

    const countPromise = Store.count();

    const [stores, count] = await Promise.all([storesPromise, countPromise]);
    const pages = Math.ceil(count / limit);
    if(!stores.length && skip ) {
        req.flash('info', `Hey! You asked for page ${page}. This doesn't exist so I put you on page ${pages} instead 🙃`)
        res.redirect(`/stores/page/${pages}`);
        return;
    }
    res.render('stores', {title: 'Stores', stores, count, page, pages})
};

const confirmOwner = (store, user) => {
    if(!store.author.equals(user._id)) {
        throw Error('You must own a store in order to edit it!');
    }
};

exports.editStore = async(req, res) => {
    // 1. Find the store given the ID
    const store = await Store.findOne({ _id: req.params.id });
    // 2. Confirm they are the owner of the store
    confirmOwner(store, req.user);
    // 3. Render out the edit form so the use can update their store
    res.render('editStore', { title: `Edit ${store.name}`, store });
};

exports.updateStore = async(req, res) => {
    // set the location data to be a point
    req.body.location.type = 'Point';
    // 1. find and update the store
    const store = await Store.findOneAndUpdate({ _id: req.params.id }, req.body, {
        new: true, // return the new store instead of the old one
        runValidators: true,
    }).exec();
    req.flash('success', `Successfully updated <strong>${store.name}</strong>. <a href="/store/${store.slug}">View Store →</a>`)
    // 2. redirect user to the store and notify user that it worked
    res.redirect(`/stores/${store._id}/edit`);
};

exports.getStoreBySlug = async (req, res, next) => {
    const store = await Store.findOne({ slug: req.params.slug }).populate('author reviews');
    if(!store) return next();
    res.render('store', { store, title: store.name })
};

exports.getStoresByTag = async (req, res) => {
    const tag = req.params.tag;
    const tagQuery = tag || { $exists: true }
    // because the tags and stores queries don't rely on eachother to be there you can await them at the same time. This way they'll both run at the same time and when the last one is returned
    const tagsPromise = Store.getTagsList();
    const storesPromise = Store.find({ tags: tagQuery });
    const [tags, stores] = await Promise.all([tagsPromise, storesPromise])
    res.render('tags', {tags, title: 'Tags', tag, stores});
}




exports.searchStores = async (req, res) => {
    const stores = await Store
    // find store that match the search query
    .find({
        $text: {
            $search: req.query.q
        }
    }, {
        // gives them a score on valid they are (search for coffee where the word coffee is present multiple times in the text receives a heigher score)
        score: { $meta: 'textScore'}
    })
    // sort them on the matching score
    .sort({
        score: { $meta: 'textScore'}
    })
    // limit to only 5 results
    .limit(5);
    res.json(stores);
}

exports.mapStores = async (req, res) => {
    const coordinates = [req.query.lng, req.query.lat] // searched coordinates from the query
        .map(parseFloat) // map over the array and turn them into numbers
    const q = {
        location: {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates
                },
                $maxDistance: 10000 // 10km
            }
        }
    }
    const stores = await Store
        .find(q) // find all stores that fit the query. 
        .select('slug name description location photo') // only select certain properties to return (we don't need the author on this one for example)
        .limit(10); // return a maximum of 10 points to avoid having to many pins on the map
    res.json( stores )
}

exports.mapPage = (req, res) => {
    res.render('map', {title: 'Map'});
}

exports.heartStore = async (req, res) => {
    const hearts = req.user.hearts.map(obj => obj.toString()); // grab the list of hearts of the currently logged in user
    const operator = hearts.includes(req.params.id) ? '$pull' : '$addToSet'; // check if the id of the store is already present in the hearts array of that user if it is remove it from there, if it isn't add it to the array
    const user = await User.findByIdAndUpdate(req.user._id,  // get the current user from the database
        { [operator]: { hearts: req.params.id }}, // use the operator variable from the next line to either add or remove the id from their hearts array
        { new: true } // return the newly updated user... by default it would have send back the previous state of the user
    );
    res.json(user);
};

exports.getHearts = async (req, res) => {
    const stores = await Store.find({
        _id: { $in: req.user.hearts }  // find the stores of which their id are present in the users list of hearts
    });
    res.render('stores', {title: 'Hearted Stores', stores})
};

exports.getTopStores = async (req, res) => {
    const stores = await Store.getTopStores();
    res.render('topStores', {stores, title: '★ Top Stores!'})
}