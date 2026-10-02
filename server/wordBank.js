/**
 * ============================================================================
 * Transcribble Centralized Word Bank & Card Engine
 * ============================================================================
 * 
 * Provides an extensive, high-variety library of 116+ curated cards spanning
 * 8 diverse categories for both:
 *  - Classic Mode: Reverse Pictionary & Taboo (secret word + banned words)
 *  - Impostor Mode: Sequential collaborative drawing (secret word + category)
 * 
 * Features:
 *  - Clean abstraction & non-repeating random selection per room session.
 *  - Automated resets when all cards in the bank have been cycled.
 */

const MASTER_WORD_BANK = [
  // --------------------------------------------------------------------------
  // 1. Food, Treats & Beverages (15 Cards)
  // --------------------------------------------------------------------------
  { word: 'Apple', category: 'Food', bannedWords: ['Fruit', 'Red', 'Tree', 'Pie', 'Juice', 'Doctor', 'Mac', 'iPhone'] },
  { word: 'Pizza', category: 'Food', bannedWords: ['Cheese', 'Pepperoni', 'Italy', 'Crust', 'Slice', 'Delivery', 'Dough', 'Oven'] },
  { word: 'Popcorn', category: 'Food', bannedWords: ['Movie', 'Corn', 'Kernel', 'Butter', 'Salt', 'Microwave', 'Theater', 'Snack'] },
  { word: 'Hamburger', category: 'Food', bannedWords: ['Beef', 'Bun', 'Patty', 'Fast Food', 'Meat', 'Grill', 'McDonald', 'Pickle'] },
  { word: 'Ice Cream', category: 'Dessert', bannedWords: ['Cold', 'Cone', 'Scoop', 'Sweet', 'Vanilla', 'Chocolate', 'Freeze', 'Dairy'] },
  { word: 'Taco', category: 'Food', bannedWords: ['Mexican', 'Shell', 'Beef', 'Tortilla', 'Salsa', 'Tuesday', 'Cheese', 'Spicy'] },
  { word: 'Sushi', category: 'Food', bannedWords: ['Fish', 'Rice', 'Seaweed', 'Raw', 'Roll', 'Japan', 'Wasabi', 'Chopsticks'] },
  { word: 'Pancake', category: 'Food', bannedWords: ['Breakfast', 'Syrup', 'Flapjack', 'Butter', 'Stack', 'Batter', 'Griddle', 'Morning'] },
  { word: 'Donut', category: 'Dessert', bannedWords: ['Hole', 'Glazed', 'Sweet', 'Pastry', 'Round', 'Bakery', 'Coffee', 'Sprinkles'] },
  { word: 'Spaghetti', category: 'Food', bannedWords: ['Pasta', 'Noodle', 'Italian', 'Meatball', 'Sauce', 'Tomato', 'Fork', 'Long'] },
  { word: 'Watermelon', category: 'Food', bannedWords: ['Fruit', 'Summer', 'Green', 'Red', 'Seeds', 'Slice', 'Melon', 'Sweet'] },
  { word: 'Cookie', category: 'Dessert', bannedWords: ['Bake', 'Chocolate Chip', 'Sweet', 'Milk', 'Dough', 'Oven', 'Snack', 'Biscuit'] },
  { word: 'Sandwich', category: 'Food', bannedWords: ['Bread', 'Lunch', 'Slice', 'Meat', 'Ham', 'Cheese', 'Mayo', 'Toast'] },
  { word: 'Cupcake', category: 'Dessert', bannedWords: ['Cake', 'Frosting', 'Mini', 'Birthday', 'Sweet', 'Bakery', 'Wrapper', 'Sprinkles'] },
  { word: 'French Fries', category: 'Food', bannedWords: ['Potato', 'Salty', 'Fast Food', 'Ketchup', 'Fried', 'Oil', 'Crispy', 'Side'] },

  // --------------------------------------------------------------------------
  // 2. Animals & Wildlife (16 Cards)
  // --------------------------------------------------------------------------
  { word: 'Cat', category: 'Animals', bannedWords: ['Pet', 'Meow', 'Feline', 'Dog', 'Kitten', 'Whisker', 'Fur', 'Tail'] },
  { word: 'Dog', category: 'Animals', bannedWords: ['Puppy', 'Bark', 'Canine', 'Pet', 'Leash', 'Bone', 'Fur', 'Tail'] },
  { word: 'Spider', category: 'Animals', bannedWords: ['Web', 'Eight', 'Legs', 'Insect', 'Bite', 'Arachnid', 'Creepy', 'Crawl'] },
  { word: 'Penguin', category: 'Animals', bannedWords: ['Bird', 'Antarctica', 'Ice', 'Tuxedo', 'Cold', 'Fly', 'Waddle', 'Snow'] },
  { word: 'Elephant', category: 'Animals', bannedWords: ['Trunk', 'Tusk', 'Huge', 'Gray', 'Ears', 'African', 'Animal', 'Heavy'] },
  { word: 'Octopus', category: 'Sea Life', bannedWords: ['Tentacles', 'Eight', 'Ocean', 'Sea', 'Ink', 'Suction', 'Arms', 'Water'] },
  { word: 'Lion', category: 'Animals', bannedWords: ['Roar', 'Mane', 'King', 'Jungle', 'Cat', 'Safari', 'Predator', 'Pride'] },
  { word: 'Dolphin', category: 'Sea Life', bannedWords: ['Ocean', 'Swim', 'Mammal', 'Smart', 'Blowhole', 'Flipper', 'Porpoise', 'Jump'] },
  { word: 'Kangaroo', category: 'Animals', bannedWords: ['Australia', 'Jump', 'Hop', 'Pouch', 'Joey', 'Mammal', 'Bounce', 'Tail'] },
  { word: 'Butterfly', category: 'Animals', bannedWords: ['Wings', 'Caterpillar', 'Insect', 'Cocoon', 'Fly', 'Colorful', 'Flower', 'Metamorphosis'] },
  { word: 'Chameleon', category: 'Animals', bannedWords: ['Color', 'Change', 'Lizard', 'Reptile', 'Camouflage', 'Tongue', 'Green', 'Blend'] },
  { word: 'Owl', category: 'Animals', bannedWords: ['Night', 'Bird', 'Hoot', 'Wise', 'Eyes', 'Nocturnal', 'Feathers', 'Tree'] },
  { word: 'Giraffe', category: 'Animals', bannedWords: ['Neck', 'Tall', 'Spots', 'Africa', 'Yellow', 'Long', 'Leaves', 'Animal'] },
  { word: 'Shark', category: 'Sea Life', bannedWords: ['Teeth', 'Bite', 'Ocean', 'Fin', 'Jaws', 'Predator', 'Danger', 'Fish'] },
  { word: 'Turtle', category: 'Animals', bannedWords: ['Shell', 'Slow', 'Reptile', 'Green', 'Sea', 'Crawl', 'Snapping', 'Armor'] },
  { word: 'Frog', category: 'Animals', bannedWords: ['Hop', 'Jump', 'Green', 'Pond', 'Tadpole', 'Ribbit', 'Amphibian', 'Lily Pad'] },

  // --------------------------------------------------------------------------
  // 3. Vehicles & Transportation (14 Cards)
  // --------------------------------------------------------------------------
  { word: 'Airplane', category: 'Transport', bannedWords: ['Fly', 'Wings', 'Pilot', 'Sky', 'Airport', 'Jet', 'Travel', 'Engine'] },
  { word: 'Submarine', category: 'Vehicles', bannedWords: ['Underwater', 'Ocean', 'Torpedo', 'Yellow', 'Periscope', 'Ship', 'Boat', 'Dive'] },
  { word: 'Bicycle', category: 'Vehicles', bannedWords: ['Wheels', 'Ride', 'Pedal', 'Handlebars', 'Bike', 'Chain', 'Two', 'Cycle'] },
  { word: 'Helicopter', category: 'Vehicles', bannedWords: ['Rotor', 'Blades', 'Fly', 'Chopper', 'Sky', 'Hover', 'Propeller', 'Pilot'] },
  { word: 'Rocket', category: 'Space', bannedWords: ['Space', 'Launch', 'Astronaut', 'NASA', 'Moon', 'Fly', 'Fuel', 'Countdown'] },
  { word: 'Hot Air Balloon', category: 'Vehicles', bannedWords: ['Basket', 'Float', 'Fire', 'Sky', 'Ride', 'Gas', 'Air', 'Fly'] },
  { word: 'Train', category: 'Transport', bannedWords: ['Tracks', 'Locomotive', 'Rails', 'Engine', 'Choo', 'Cargo', 'Station', 'Caboose'] },
  { word: 'Skateboard', category: 'Vehicles', bannedWords: ['Wheels', 'Deck', 'Ride', 'Skate', 'Kickflip', 'Ollies', 'Park', 'Board'] },
  { word: 'Sailboat', category: 'Maritime', bannedWords: ['Wind', 'Canvas', 'Mast', 'Ocean', 'Water', 'Boat', 'Float', 'Sea'] },
  { word: 'Tractor', category: 'Vehicles', bannedWords: ['Farm', 'Field', 'Plow', 'Wheels', 'Green', 'John Deere', 'Agriculture', 'Engine'] },
  { word: 'Motorcycle', category: 'Vehicles', bannedWords: ['Bike', 'Engine', 'Two Wheels', 'Helmet', 'Ride', 'Harley', 'Fast', 'Exhaust'] },
  { word: 'Spaceship', category: 'Space', bannedWords: ['Alien', 'Orbit', 'UFO', 'Galaxy', 'Travel', 'Space', 'Sci-Fi', 'Planet'] },
  { word: 'Ambulance', category: 'Vehicles', bannedWords: ['Hospital', 'Siren', 'Emergency', 'Red Cross', 'Medic', 'Patient', 'Doctor', 'Flashing'] },
  { word: 'Fire Truck', category: 'Vehicles', bannedWords: ['Siren', 'Red', 'Hose', 'Ladder', 'Firefighter', 'Water', 'Emergency', 'Hydrant'] },

  // --------------------------------------------------------------------------
  // 4. Objects & Everyday Gadgets (16 Cards)
  // --------------------------------------------------------------------------
  { word: 'Clock', category: 'Objects', bannedWords: ['Time', 'Hour', 'Minute', 'Second', 'Watch', 'Tick', 'Hands', 'Alarm'] },
  { word: 'Camera', category: 'Technology', bannedWords: ['Photo', 'Picture', 'Snap', 'Lens', 'Flash', 'Shoot', 'Video', 'Film'] },
  { word: 'Umbrella', category: 'Objects', bannedWords: ['Rain', 'Wet', 'Storm', 'Open', 'Weather', 'Canopy', 'Dry', 'Protect'] },
  { word: 'Guitar', category: 'Music', bannedWords: ['Strings', 'Music', 'Play', 'Rock', 'Instrument', 'Acoustic', 'Electric', 'Band'] },
  { word: 'Telescope', category: 'Science', bannedWords: ['Stars', 'Space', 'Look', 'Moon', 'Sky', 'Astronomy', 'Lens', 'Planet'] },
  { word: 'Backpack', category: 'Objects', bannedWords: ['Bag', 'School', 'Straps', 'Books', 'Carry', 'Zipper', 'Pack', 'Travel'] },
  { word: 'Headphones', category: 'Technology', bannedWords: ['Music', 'Ears', 'Sound', 'Audio', 'Listen', 'Cord', 'Wireless', 'Beats'] },
  { word: 'Flashlight', category: 'Objects', bannedWords: ['Dark', 'Beam', 'Torch', 'Light', 'Battery', 'Bulb', 'Night', 'Shine'] },
  { word: 'Scissors', category: 'Objects', bannedWords: ['Cut', 'Paper', 'Sharp', 'Blades', 'Snip', 'Shear', 'Two', 'Tool'] },
  { word: 'Sunglasses', category: 'Objects', bannedWords: ['Sun', 'Eyes', 'Shades', 'Dark', 'Protect', 'Summer', 'Bright', 'Glasses'] },
  { word: 'Toothbrush', category: 'Objects', bannedWords: ['Teeth', 'Brush', 'Paste', 'Clean', 'Mouth', 'Bristles', 'Morning', 'Dental'] },
  { word: 'Key', category: 'Objects', bannedWords: ['Lock', 'Door', 'Open', 'Metal', 'Keychain', 'Car', 'Turn', 'Unlock'] },
  { word: 'Compass', category: 'Science', bannedWords: ['North', 'South', 'East', 'West', 'Direction', 'Needle', 'Map', 'Navigation'] },
  { word: 'Crown', category: 'Objects', bannedWords: ['King', 'Queen', 'Royal', 'Gold', 'Jewels', 'Head', 'Palace', 'Prince'] },
  { word: 'Paintbrush', category: 'Art', bannedWords: ['Art', 'Color', 'Bristles', 'Canvas', 'Paint', 'Artist', 'Draw', 'Stroke'] },
  { word: 'Hammer', category: 'Tools', bannedWords: ['Nail', 'Tool', 'Hit', 'Metal', 'Wood', 'Strike', 'Build', 'Workshop'] },

  // --------------------------------------------------------------------------
  // 5. Nature, Weather & Space (15 Cards)
  // --------------------------------------------------------------------------
  { word: 'Campfire', category: 'Outdoors', bannedWords: ['Fire', 'Wood', 'Tent', 'Marshmallow', 'Smoke', 'Burn', 'Hot', 'Flame'] },
  { word: 'Snowman', category: 'Winter', bannedWords: ['Snow', 'Winter', 'Carrot', 'Cold', 'Frosty', 'White', 'Melting', 'Coal'] },
  { word: 'Cactus', category: 'Nature', bannedWords: ['Desert', 'Prickly', 'Plant', 'Spines', 'Green', 'Water', 'Thorn', 'Succulent'] },
  { word: 'Volcano', category: 'Nature', bannedWords: ['Lava', 'Erupt', 'Mountain', 'Magma', 'Ash', 'Fire', 'Hot', 'Crater'] },
  { word: 'Rainbow', category: 'Nature', bannedWords: ['Colors', 'Sky', 'Rain', 'Red', 'Violet', 'Arc', 'Sun', 'Pot of Gold'] },
  { word: 'Tornado', category: 'Weather', bannedWords: ['Twister', 'Wind', 'Storm', 'Funnel', 'Spin', 'Cyclone', 'Destruction', 'Weather'] },
  { word: 'Waterfall', category: 'Nature', bannedWords: ['Water', 'River', 'Fall', 'Cascade', 'Cliff', 'Niagara', 'Splash', 'Stream'] },
  { word: 'Island', category: 'Geography', bannedWords: ['Ocean', 'Water', 'Palm Tree', 'Beach', 'Sand', 'Land', 'Isolated', 'Tropical'] },
  { word: 'Lightning', category: 'Weather', bannedWords: ['Thunder', 'Storm', 'Flash', 'Bolt', 'Electricity', 'Sky', 'Strike', 'Cloud'] },
  { word: 'Cave', category: 'Nature', bannedWords: ['Dark', 'Underground', 'Rock', 'Bat', 'Stalactite', 'Cavern', 'Stone', 'Tunnel'] },
  { word: 'Coral Reef', category: 'Sea Life', bannedWords: ['Fish', 'Underwater', 'Ocean', 'Marine', 'Colorful', 'Barrier', 'Sea', 'Diver'] },
  { word: 'Meteor', category: 'Space', bannedWords: ['Space', 'Rock', 'Shooting Star', 'Crash', 'Atmosphere', 'Crater', 'Orbit', 'Asteroid'] },
  { word: 'Desert', category: 'Geography', bannedWords: ['Sand', 'Hot', 'Dry', 'Dunes', 'Camel', 'Oasis', 'Sahara', 'Sun'] },
  { word: 'Mountain', category: 'Geography', bannedWords: ['Peak', 'Climb', 'Summit', 'Snow', 'High', 'Rock', 'Everest', 'Altitude'] },
  { word: 'Sun', category: 'Space', bannedWords: ['Star', 'Bright', 'Light', 'Day', 'Heat', 'Yellow', 'Sky', 'Solar'] },

  // --------------------------------------------------------------------------
  // 6. Architecture & Landmarks (14 Cards)
  // --------------------------------------------------------------------------
  { word: 'Castle', category: 'Architecture', bannedWords: ['King', 'Queen', 'Fortress', 'Knight', 'Moat', 'Tower', 'Stone', 'Medieval'] },
  { word: 'Lighthouse', category: 'Maritime', bannedWords: ['Ocean', 'Light', 'Beacon', 'Coast', 'Tower', 'Ships', 'Water', 'Sailor'] },
  { word: 'Pyramid', category: 'Landmarks', bannedWords: ['Egypt', 'Pharaoh', 'Tomb', 'Triangle', 'Stone', 'Ancient', 'Desert', 'Mummy'] },
  { word: 'Windmill', category: 'Architecture', bannedWords: ['Wind', 'Blades', 'Mill', 'Energy', 'Holland', 'Grain', 'Farm', 'Turn'] },
  { word: 'Igloo', category: 'Architecture', bannedWords: ['Ice', 'Snow', 'Inuit', 'Arctic', 'Cold', 'Dome', 'Blocks', 'Winter'] },
  { word: 'Bridge', category: 'Architecture', bannedWords: ['Cross', 'River', 'Water', 'Road', 'Suspension', 'Golden Gate', 'Arch', 'Walk'] },
  { word: 'Treehouse', category: 'Outdoors', bannedWords: ['Tree', 'Wood', 'Ladder', 'Kids', 'Backyard', 'Climb', 'Hideout', 'Forest'] },
  { word: 'Skyscraper', category: 'Architecture', bannedWords: ['Tall', 'Building', 'City', 'High', 'Tower', 'Windows', 'Urban', 'Office'] },
  { word: 'Wind Turbine', category: 'Technology', bannedWords: ['Electricity', 'Green', 'Energy', 'Giant', 'Propeller', 'Power', 'Breeze', 'Generator'] },
  { word: 'Barn', category: 'Architecture', bannedWords: ['Farm', 'Red', 'Animals', 'Hay', 'Silo', 'Horse', 'Cow', 'Wood'] },
  { word: 'Ferris Wheel', category: 'Amusement', bannedWords: ['Carnival', 'Fair', 'Ride', 'Circle', 'Amusement Park', 'Seats', 'High', 'Spin'] },
  { word: 'Circus Tent', category: 'Entertainment', bannedWords: ['Clown', 'Big Top', 'Show', 'Acrobats', 'Stripes', 'Lions', 'Ringmaster', 'Tickets'] },
  { word: 'Statue of Liberty', category: 'Landmarks', bannedWords: ['New York', 'Torch', 'Crown', 'Green', 'America', 'Harbor', 'Copper', 'Island'] },
  { word: 'Roller Coaster', category: 'Amusement', bannedWords: ['Amusement Park', 'Track', 'Loops', 'Fast', 'Thrill', 'Ride', 'Scream', 'Theme Park'] },

  // --------------------------------------------------------------------------
  // 7. Fantasy, Magic & Spooky (14 Cards)
  // --------------------------------------------------------------------------
  { word: 'Dragon', category: 'Mythology', bannedWords: ['Fire', 'Breathe', 'Wings', 'Scales', 'Monster', 'Medieval', 'Fly', 'Reptile'] },
  { word: 'Ghost', category: 'Spooky', bannedWords: ['Boo', 'Spooky', 'Haunted', 'Sheet', 'Dead', 'Spirit', 'Halloween', 'Phantom'] },
  { word: 'Wizard', category: 'Fantasy', bannedWords: ['Magic', 'Wand', 'Spell', 'Robe', 'Beard', 'Hat', 'Sorcerer', 'Cast'] },
  { word: 'Unicorn', category: 'Mythology', bannedWords: ['Horse', 'Horn', 'Rainbow', 'Magical', 'Mythical', 'Fantasy', 'Fairy', 'White'] },
  { word: 'Mermaid', category: 'Mythology', bannedWords: ['Fish', 'Tail', 'Ocean', 'Siren', 'Ariel', 'Swimming', 'Half', 'Sea'] },
  { word: 'Vampire', category: 'Spooky', bannedWords: ['Blood', 'Fangs', 'Dracula', 'Bat', 'Cape', 'Night', 'Bite', 'Garlic'] },
  { word: 'Mummy', category: 'Spooky', bannedWords: ['Egypt', 'Wraps', 'Tomb', 'Pyramid', 'Pharaoh', 'Bandage', 'Curse', 'Dead'] },
  { word: 'Alien', category: 'Sci-Fi', bannedWords: ['Space', 'UFO', 'Extraterrestrial', 'Martian', 'Green', 'Planet', 'Sci-Fi', 'Eyes'] },
  { word: 'Genie', category: 'Mythology', bannedWords: ['Lamp', 'Wishes', 'Three', 'Magic', 'Blue', 'Rub', 'Smoke', 'Bottle'] },
  { word: 'Pirate', category: 'Adventure', bannedWords: ['Eyepatch', 'Hook', 'Parrot', 'Ship', 'Treasure', 'Skull', 'Captain', 'Sword'] },
  { word: 'Treasure Chest', category: 'Adventure', bannedWords: ['Gold', 'Coins', 'Locked', 'Pirate', 'Jewels', 'Wood', 'Box', 'Silver'] },
  { word: 'Witch', category: 'Spooky', bannedWords: ['Broom', 'Cauldron', 'Potion', 'Hat', 'Cackle', 'Black Cat', 'Brew', 'Magic'] },
  { word: 'Fairy', category: 'Fantasy', bannedWords: ['Wings', 'Dust', 'Small', 'Magic', 'Tinker', 'Pixie', 'Fly', 'Wand'] },
  { word: 'Magic Wand', category: 'Fantasy', bannedWords: ['Wizard', 'Spell', 'Stick', 'Star', 'Abracadabra', 'Cast', 'Trick', 'Wood'] },

  // --------------------------------------------------------------------------
  // 8. Hobbies, Sports & Entertainment (12 Cards)
  // --------------------------------------------------------------------------
  { word: 'Bowling', category: 'Sports', bannedWords: ['Pins', 'Ball', 'Strike', 'Alley', 'Roll', 'Spare', 'Gutter', 'Ten'] },
  { word: 'Surfing', category: 'Sports', bannedWords: ['Wave', 'Ocean', 'Board', 'Ride', 'Beach', 'Water', 'Wipeout', 'Tide'] },
  { word: 'Scuba Diving', category: 'Sports', bannedWords: ['Underwater', 'Mask', 'Oxygen', 'Tank', 'Fins', 'Ocean', 'Fish', 'Swim'] },
  { word: 'Trampoline', category: 'Sports', bannedWords: ['Jump', 'Bounce', 'Spring', 'Net', 'Flip', 'Land', 'Backyard', 'High'] },
  { word: 'Drum Set', category: 'Music', bannedWords: ['Beat', 'Sticks', 'Cymbal', 'Music', 'Bang', 'Band', 'Percussion', 'Snare'] },
  { word: 'Magic Show', category: 'Entertainment', bannedWords: ['Hat', 'Rabbit', 'Illusion', 'Cards', 'Audience', 'Trick', 'Magician', 'Disappear'] },
  { word: 'Fishing', category: 'Outdoors', bannedWords: ['Rod', 'Hook', 'Bait', 'River', 'Catch', 'Fish', 'Worm', 'Lake'] },
  { word: 'Karate', category: 'Sports', bannedWords: ['Kick', 'Punch', 'Belt', 'Black', 'Martial Arts', 'Dojo', 'Gi', 'Board'] },
  { word: 'Camping', category: 'Outdoors', bannedWords: ['Tent', 'Sleeping Bag', 'Fire', 'Woods', 'Forest', 'Outdoors', 'Hike', 'Stars'] },
  { word: 'Painting', category: 'Art', bannedWords: ['Easel', 'Canvas', 'Brush', 'Color', 'Art', 'Paint', 'Gallery', 'Portrait'] },
  { word: 'Basketball', category: 'Sports', bannedWords: ['Hoop', 'Dribble', 'Court', 'Net', 'Orange', 'Shoot', 'Dunk', 'NBA'] },
  { word: 'Soccer', category: 'Sports', bannedWords: ['Goal', 'Kick', 'Ball', 'Net', 'Pitch', 'Cleats', 'Referee', 'World Cup'] }
];

/**
 * Normalizes a word for comparison (trimmed and lowercase)
 */
function normalize(str) {
  return String(str || '').trim().toLowerCase();
}

/**
 * Returns a random card, avoiding any words that have been recently played in the room.
 * If all words have been used, clears the used list and starts a fresh rotation!
 * 
 * @param {Set<string>|Array<string>} usedWords - Set or array of normalized played words
 * @returns {{ word: string, category: string, bannedWords: string[] }}
 */
function getRandomCard(usedWords = null) {
  let usedSet = new Set();
  if (usedWords instanceof Set) {
    usedWords.forEach(w => usedSet.add(normalize(w)));
  } else if (Array.isArray(usedWords)) {
    usedWords.forEach(w => usedSet.add(normalize(w)));
  }

  // Filter available cards that have not been played recently
  let available = MASTER_WORD_BANK.filter(c => !usedSet.has(normalize(c.word)));

  // If all cards have been exhausted, reset so gameplay can continue seamlessly
  if (available.length === 0) {
    if (usedWords instanceof Set) {
      usedWords.clear();
    } else if (Array.isArray(usedWords)) {
      usedWords.length = 0;
    }
    available = MASTER_WORD_BANK;
  }

  const index = Math.floor(Math.random() * available.length);
  const card = available[index];

  // Record this word as used
  if (usedWords instanceof Set) {
    usedWords.add(normalize(card.word));
  } else if (Array.isArray(usedWords)) {
    usedWords.push(normalize(card.word));
  }

  return {
    word: card.word,
    category: card.category,
    bannedWords: [...card.bannedWords]
  };
}

/**
 * Returns the entire master word bank
 */
function getAllCards() {
  return MASTER_WORD_BANK.map(c => ({
    word: c.word,
    category: c.category,
    bannedWords: [...c.bannedWords]
  }));
}

/**
 * Returns all cards for a specific category
 */
function getCardsByCategory(category) {
  const normCat = normalize(category);
  return MASTER_WORD_BANK.filter(c => normalize(c.category) === normCat).map(c => ({
    word: c.word,
    category: c.category,
    bannedWords: [...c.bannedWords]
  }));
}

/**
 * Returns an array of all unique categories in the bank
 */
function getCategories() {
  const cats = new Set(MASTER_WORD_BANK.map(c => c.category));
  return Array.from(cats).sort();
}

/**
 * Returns the total count of cards in the word bank
 */
function getCardCount() {
  return MASTER_WORD_BANK.length;
}

module.exports = {
  MASTER_WORD_BANK,
  getRandomCard,
  getAllCards,
  getCardsByCategory,
  getCategories,
  getCardCount
};
