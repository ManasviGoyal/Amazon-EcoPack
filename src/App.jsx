import React, { useState, useEffect, useMemo } from 'react';
import { Package, Box, Leaf, Clock, Trash2, ShoppingBag, Search, PlusCircle, MinusCircle, Info, Bookmark } from 'lucide-react';

// Define common Amazon box sizes with dimensions (cm) and weight limits (kg)
// Added baseCO2 (kg) and perKgCO2 (kg/kg) for each box type
const AMAZON_BOX_SIZES = [
  { name: 'Small Box (S3)', length: 25, width: 20, height: 12, volume: 6000, maxWeight: 5, baseCO2: 0.15, perKgCO2: 0.06 },
  { name: 'Medium Box (M3)', length: 35, width: 25, height: 15, volume: 13125, maxWeight: 10, baseCO2: 0.20, perKgCO2: 0.055 },
  { name: 'Large Box (L4)', length: 45, width: 35, height: 20, volume: 31500, maxWeight: 15, baseCO2: 0.25, perKgCO2: 0.05 },
  { name: 'X-Large Box (X1)', length: 60, width: 40, height: 30, volume: 72000, maxWeight: 22, baseCO2: 0.30, perKgCO2: 0.045 }
];

// Helper to calculate item volume
const getItemVolume = (item) => item.length * item.width * item.height;

/**
 * Checks if an item fits into a box based on dimensions and weight.
 */
const doesItemFit = (item, box, currentFilledVolume, currentTotalWeight) => {
    const itemVolume = getItemVolume(item);
    return (
        item.length <= box.length &&
        item.width <= box.width &&
        item.height <= box.height &&
        currentFilledVolume + itemVolume <= box.volume &&
        currentTotalWeight + item.weight <= box.maxWeight
    );
};

/**
 * Packs items into boxes using an optimal approach that balances carbon efficiency (fewer boxes)
 * and packaging efficiency (higher fill rates).
 *
 * @param {Array<Object>} items - Array of all individual items.
 * @param {Array<Object>} boxTypes - Array of available box types.
 * @returns {Array<Object>} A list of packed boxes.
 */
const packOptimal = (items, boxTypes) => {
    if (!items.length) return [];

    const sortedItems = [...items].sort((a, b) => getItemVolume(b) - getItemVolume(a)); // Sort by volume descending
    const sortedBoxesAsc = [...boxTypes].sort((a, b) => a.volume - b.volume); // Smallest to largest

    // --- Phase 1: Single Box Optimization (Find the SMALLEST single box that fits all items) ---
    for (const boxType of sortedBoxesAsc) { // Iterate from smallest to largest
        let tempFilledVolume = 0;
        let tempTotalWeight = 0;
        let allItemsFitInOneBox = true;

        for (const item of sortedItems) {
            if (doesItemFit(item, boxType, tempFilledVolume, tempTotalWeight)) {
                tempFilledVolume += getItemVolume(item);
                tempTotalWeight += item.weight;
            } else {
                allItemsFitInOneBox = false;
                break; // This box type cannot fit all items
            }
        }

        if (allItemsFitInOneBox) {
            // Found the smallest single box that fits all items - this is the most efficient single-box solution
            return [{
                ...boxType,
                items: sortedItems,
                filledVolume: tempFilledVolume,
                totalWeight: tempTotalWeight,
            }];
        }
    }

    // --- Phase 2: Multi-Package Heuristic (If no single box fits all) ---
    // Use a greedy approach to pack into the fewest and most efficient combination of multiple boxes.
    // Prioritize filling existing boxes well, and only open new boxes (smallest suitable) when necessary.

    let packedBoxes = [];
    let unpackedItems = [...sortedItems]; // Items still needing to be packed

    while (unpackedItems.length > 0) {
        let currentItem = unpackedItems.shift(); // Take the next largest item to pack

        let bestFitBoxIndex = -1;
        let highestPotentialFill = -1; // Track the best fill for an *existing* box

        // Try to fit currentItem into an EXISTING box first
        for (let i = 0; i < packedBoxes.length; i++) {
            const existingBox = packedBoxes[i];
            if (doesItemFit(currentItem, existingBox, existingBox.filledVolume, existingBox.totalWeight)) {
                const potentialNewFill = ((existingBox.filledVolume + getItemVolume(currentItem)) / existingBox.volume) * 100;
                // Prioritize the box that results in the highest fill percentage *after* adding the item
                if (potentialNewFill > highestPotentialFill) {
                    highestPotentialFill = potentialNewFill;
                    bestFitBoxIndex = i;
                }
            }
        }

        if (bestFitBoxIndex !== -1) {
            // Place item in the best existing box found
            const targetBox = packedBoxes[bestFitBoxIndex];
            targetBox.items.push(currentItem);
            targetBox.filledVolume += getItemVolume(currentItem);
            targetBox.totalWeight += currentItem.weight;

            // Try to fill this specific box further with other remaining unpacked items
            let itemsToRecheck = [...unpackedItems]; // Items still unpacked
            unpackedItems = []; // Reset unpackedItems to build it back with remaining
            for (const otherItem of itemsToRecheck) {
                if (doesItemFit(otherItem, targetBox, targetBox.filledVolume, targetBox.totalWeight)) {
                    targetBox.items.push(otherItem);
                    targetBox.filledVolume += getItemVolume(otherItem);
                    targetBox.totalWeight += otherItem.weight;
                } else {
                    unpackedItems.push(otherItem); // This item couldn't fit, keep for next iteration
                }
            }
        } else {
            // No good fit in existing boxes, open a NEW box.
            // Find the smallest new box type that can fit this current item.
            let newBoxType = sortedBoxesAsc.find(box => 
                currentItem.length <= box.length &&
                currentItem.width <= box.width &&
                currentItem.height <= box.height &&
                currentItem.weight <= box.maxWeight
            );

            if (newBoxType) {
                const newBox = {
                    ...newBoxType,
                    items: [currentItem],
                    filledVolume: getItemVolume(currentItem),
                    totalWeight: currentItem.weight,
                };
                // Try to fill this new box further with other remaining unpacked items
                let itemsToRecheck = [...unpackedItems];
                unpackedItems = [];
                for (const otherItem of itemsToRecheck) {
                    if (doesItemFit(otherItem, newBox, newBox.filledVolume, newBox.totalWeight)) {
                        newBox.items.push(otherItem);
                        newBox.filledVolume += getItemVolume(otherItem);
                        newBox.totalWeight += otherItem.weight;
                    } else {
                        unpackedItems.push(otherItem);
                    }
                }
                packedBoxes.push(newBox);
            } else {
                // Current item cannot fit in any box type, even a new one.
                console.warn(`Optimal Packing: Item '${currentItem.name}' cannot be packed into any available box.`);
                // This item is truly un-packable, it's removed from consideration.
            }
        }
    }

    return packedBoxes;
};

// Helper to calculate metrics for a set of packed boxes
const calculateMetrics = (packedBoxes, flatItemList) => {
    const totalPackedVolume = packedBoxes.reduce((sum, box) => sum + box.filledVolume, 0);
    const totalBoxesVolume = packedBoxes.reduce((sum, box) => sum + box.volume, 0);
    
    const packagingEfficiencyScore = totalBoxesVolume > 0 ? (totalPackedVolume / totalBoxesVolume) * 100 : 0;
    
    // Calculate CO2 impact using custom values from each box
    const optimalCO2Impact = packedBoxes.reduce((sum, box) => {
        return sum + box.baseCO2 + (box.totalWeight * box.perKgCO2);
    }, 0);

    // Calculate individual shipment CO2 for comparison (each item shipped separately)
    // This assumes each item, if shipped alone, would go into the smallest suitable box.
    const individualShipmentCO2 = flatItemList.reduce((sum, item) => {
        // Find the smallest box that can fit this single item
        const suitableBox = AMAZON_BOX_SIZES.sort((a, b) => a.volume - b.volume).find(box =>
            item.length <= box.length && item.width <= box.width && item.height <= box.height && item.weight <= box.maxWeight
        );
        if (suitableBox) {
            return sum + suitableBox.baseCO2 + (item.weight * suitableBox.perKgCO2);
        }
        return sum; // If item can't fit in any box, it's not shipped
    }, 0);

    const co2SavedByConsolidation = individualShipmentCO2 - optimalCO2Impact;

    // Generate box breakdown string
    const boxCounts = packedBoxes.reduce((acc, box) => {
        acc[box.name] = (acc[box.name] || 0) + 1;
        return acc;
    }, {});
    const boxBreakdown = Object.entries(boxCounts)
        .map(([name, count]) => `${count}x ${name.replace(/\s\(.*\)/, '')}`) // Remove (S3), (M3) etc.
        .join(', ');

    return {
        packedBoxes,
        packagingEfficiencyScore,
        optimalCO2Impact,
        co2SavedByConsolidation,
        totalBoxes: packedBoxes.length,
        boxBreakdown
    };
};

/**
 * Helper to simulate adding multiple units of an item type to existing boxes without opening new ones.
 * Returns the quantity successfully added and the new packed boxes if successful.
 */
const tryAddItemsToExistingBoxes = (itemTypeToAdd, quantityToTry, existingPackedBoxes) => {
    let simulatedPackedBoxes = existingPackedBoxes.map(box => ({
        ...box,
        items: [...box.items],
    }));

    let itemsSuccessfullyAdded = 0;

    for (let q = 0; q < quantityToTry; q++) {
        let bestBoxIndex = -1;
        let highestPotentialFill = -1;

        for (let i = 0; i < simulatedPackedBoxes.length; i++) {
            const box = simulatedPackedBoxes[i];
            if (doesItemFit(itemTypeToAdd, box, box.filledVolume, box.totalWeight)) {
                const potentialNewFill = ((box.filledVolume + getItemVolume(itemTypeToAdd)) / box.volume) * 100;
                if (potentialNewFill > highestPotentialFill) {
                    highestPotentialFill = potentialNewFill;
                    bestBoxIndex = i;
                }
            }
        }

        if (bestBoxIndex !== -1) {
            const targetBox = simulatedPackedBoxes[bestBoxIndex];
            targetBox.items.push(itemTypeToAdd);
            targetBox.filledVolume += getItemVolume(itemTypeToAdd);
            targetBox.totalWeight += itemTypeToAdd.weight;
            itemsSuccessfullyAdded++;
        } else {
            // No more units of this item can fit in existing boxes
            break;
        }
    }

    return {
        quantityAdded: itemsSuccessfullyAdded,
        newPackedBoxes: simulatedPackedBoxes,
        success: itemsSuccessfullyAdded > 0
    };
};


/**
 * Generates suggestions for adding 'saved for later' items to the current order
 * to improve sustainability metrics, including CO2 savings.
 * @param {Array<Object>} currentFlatItems - Flat list of items currently in the cart.
 * @param {Object} savedForLaterItemsMap - Map of saved items (id -> {item, quantity}).
 * @param {Array<Object>} boxTypes - Available box types.
 * @returns {Array<Object>} List of suggested items with potential benefits including CO2 savings,
 * or indicators if items are too big/heavy.
 */
const getBulkOrderSuggestions = (currentFlatItems, savedForLaterItemsMap, boxTypes) => {
    if (Object.keys(savedForLaterItemsMap).length === 0) return [];

    const suggestions = [];

    // Calculate baseline metrics for the current order only
    const originalPackedBoxes = packOptimal(currentFlatItems, boxTypes);
    const originalMetrics = calculateMetrics(originalPackedBoxes, currentFlatItems);

    // Iterate through unique item types in savedForLaterItemsMap
    for (const itemId in savedForLaterItemsMap) {
        const savedItemType = savedForLaterItemsMap[itemId]; // This is the item object with its total quantity in saved
        const quantityInSaved = savedItemType.quantity;

        // Try to add as many units as possible of this saved item type to EXISTING boxes
        const { quantityAdded, newPackedBoxes: hypotheticalPackedBoxesForExisting } = 
            tryAddItemsToExistingBoxes(savedItemType, quantityInSaved, originalPackedBoxes);

        if (quantityAdded > 0) { // If at least one unit of the saved item fits
            // Create a hypothetical combined list of items for metric calculation
            const hypotheticalItemsCombined = [...currentFlatItems];
            for(let i=0; i<quantityAdded; i++) {
                hypotheticalItemsCombined.push(savedItemType);
            }
            
            const hypotheticalMetrics = calculateMetrics(hypotheticalPackedBoxesForExisting, hypotheticalItemsCombined);

            // Calculate CO2 impact if *only* these `quantityAdded` saved items were shipped optimally alone
            const savedItemsOnlyFlatList = [];
            for(let i=0; i<quantityAdded; i++) {
                savedItemsOnlyFlatList.push(savedItemType);
            }
            const savedItemsOnlyPackedBoxes = packOptimal(savedItemsOnlyFlatList, boxTypes);
            const savedItemsOnlyMetrics = calculateMetrics(savedItemsOnlyPackedBoxes, savedItemsOnlyFlatList);
            const co2IfSavedItemShippedSeparately = savedItemsOnlyMetrics.optimalCO2Impact;
            
            // Total CO2 if current order and saved item's added quantity are shipped separately
            const totalCO2IfSeparate = originalMetrics.optimalCO2Impact + co2IfSavedItemShippedSeparately;

            // CO2 saved by combining
            const co2SavedByCombining = totalCO2IfSeparate - hypotheticalMetrics.optimalCO2Impact;

            const efficiencyImprovement = hypotheticalMetrics.packagingEfficiencyScore - originalMetrics.packagingEfficiencyScore;
            
            // Suggest only if there's a positive CO2 saving or a noticeable efficiency improvement
            if (co2SavedByCombining > 0.01 || efficiencyImprovement > 0.1) {
                suggestions.push({
                    type: 'suggestion', // Indicate it's a valid suggestion
                    item: savedItemType, // The original item type (e.g., {id: 'mug', quantity: 3})
                    quantityToSuggest: quantityAdded, // The actual quantity that fits
                    fewerBoxes: false, // Explicitly false as we only consider adding to existing boxes
                    efficiencyImprovement: efficiencyImprovement,
                    co2SavedByCombining: co2SavedByCombining,
                    newTotalBoxes: originalMetrics.totalBoxes, // Total boxes should remain same
                    oldTotalBoxes: originalMetrics.totalBoxes
                });
            }
        } else { // No units of this saved item type fit in existing boxes
            suggestions.push({
                type: 'tooBig', // Indicate it's too big/heavy
                item: savedItemType,
                message: `Too large or heavy to fit in with the current order without requiring additional boxes or a larger box type.`
            });
        }
    }

    return suggestions;
};


// Component to render a single visualization block
const PackingVisualization = ({ title, metrics }) => {
    const { packedBoxes, packagingEfficiencyScore, optimalCO2Impact, co2SavedByConsolidation, totalBoxes, boxBreakdown } = metrics;
    return (
        <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
            <h3 className="text-xl font-bold text-[#131921] mb-3 flex items-center gap-2">
                <Package className="w-5 h-5 text-gray-600" /> {title}
            </h3>
            <div className="space-y-2 mb-4 text-sm">
                <p><span className="font-semibold">Total Boxes:</span> <span className="text-blue-700 font-bold">{totalBoxes}</span></p>
                {totalBoxes > 0 && <p><span className="font-semibold">Box Breakdown:</span> {boxBreakdown || 'N/A'}</p>}
                <p><span className="font-semibold">Packaging Efficiency:</span> <span className="text-[#FF9900] font-bold">{packagingEfficiencyScore.toFixed(1)}%</span></p>
                <p><span className="font-semibold">Estimated CO₂ Impact:</span> <span className="text-green-700 font-bold">{optimalCO2Impact.toFixed(2)} kg</span></p>
                {co2SavedByConsolidation > 0.01 && <p className="text-xs text-green-800 bg-green-100 p-1 rounded-md">Saved ~{co2SavedByConsolidation.toFixed(2)} kg CO₂ compared to individual item shipments.</p>}
            </div>
            <div className="flex flex-wrap gap-3 justify-center items-end min-h-[100px]">
                {packedBoxes.length === 0 ? (
                    <p className="text-gray-500 text-sm my-auto">No items to pack or items don't fit.</p>
                ) : (
                    packedBoxes.map((box, index) => {
                        const filledPercentage = (box.filledVolume / box.volume) * 100;
                        return (
                            <div key={index} className="relative w-24 h-24 bg-gray-200 rounded-md border border-gray-300 flex flex-col justify-end" title={`${box.name} (${filledPercentage.toFixed(0)}% full)`}>
                                <div className="absolute top-0.5 left-0.5 right-0.5 text-center text-xs text-gray-600 font-semibold bg-white/70 rounded px-0.5 py-0">{box.name.replace(/\s\(.*\)/, '')}</div>
                                <div style={{ height: `${filledPercentage}%` }} className="bg-[#007185] rounded-b-sm flex items-center justify-center text-white font-bold text-sm transition-all duration-500 ease-out">
                                    {filledPercentage > 20 && `${filledPercentage.toFixed(0)}%`}
                                </div>
                                <div className="absolute bottom-0.5 right-0.5 text-xs bg-white/70 text-black px-0.5 rounded">{box.totalWeight.toFixed(1)}kg</div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};


// Main App component for the Smart Cart Sustainability Optimizer
function App() {
  const [cartItems, setCartItems] = useState(() => {
    const savedItems = localStorage.getItem('smartCartItemsV2');
    return savedItems ? JSON.parse(savedItems) : {};
  });
  const [savedForLaterItems, setSavedForLaterItems] = useState(() => {
    const savedItems = localStorage.getItem('smartCartSavedForLater');
    return savedItems ? JSON.parse(savedItems) : {};
  });
  const [searchTerm, setSearchTerm] = useState('');

  const predefinedItems = useMemo(() => [
    { id: 'book', name: 'Book', length: 25, width: 18, height: 4, weight: 0.8, imageUrl: 'https://placehold.co/60x60/FF9900/FFFFFF?text=Book' },
    { id: 'laptop', name: 'Laptop', length: 35, width: 25, height: 3, weight: 2.0, imageUrl: 'https://placehold.co/60x60/007185/FFFFFF?text=Laptop' },
    { id: 'mug', name: 'Coffee Mug', length: 12, width: 9, height: 10, weight: 0.4, imageUrl: 'https://placehold.co/60x60/FFD700/000000?text=Mug' },
    { id: 'tshirt', name: 'T-Shirt', length: 20, width: 15, height: 2, weight: 0.2, imageUrl: 'https://placehold.co/60x60/87CEEB/FFFFFF?text=Shirt' },
    { id: 'headphones', name: 'Headphones', length: 20, width: 18, height: 10, weight: 0.3, imageUrl: 'https://placehold.co/60x60/9370DB/FFFFFF?text=HP' },
    { id: 'keyboard', name: 'Keyboard', length: 45, width: 15, height: 4, weight: 1.0, imageUrl: 'https://placehold.co/60x60/A9A9A9/FFFFFF?text=KB' },
    { id: 'echo_dot', name: 'Echo Dot', length: 10, width: 10, height: 5, weight: 0.3, imageUrl: 'https://placehold.co/60x60/232F3E/FFFFFF?text=Echo' },
    { id: 'kindle', name: 'Kindle', length: 17, width: 12, height: 1, weight: 0.18, imageUrl: 'https://placehold.co/60x60/FFFFFF/000000?text=Kindle' },
    { id: 'fire_tv_stick', name: 'Fire TV Stick', length: 15, width: 4, height: 1.5, weight: 0.05, imageUrl: 'https://placehold.co/60x60/FF4500/FFFFFF?text=FireTV' },
    { id: 'fire_tablet', name: 'Fire Tablet', length: 20, width: 14, height: 1, weight: 0.3, imageUrl: 'https://placehold.co/60x60/8A2BE2/FFFFFF?text=Tablet' },
  ], []);

  useEffect(() => {
    localStorage.setItem('smartCartItemsV2', JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    localStorage.setItem('smartCartSavedForLater', JSON.stringify(savedForLaterItems));
  }, [savedForLaterItems]);

  const handleUpdateQuantity = (item, change) => {
    setCartItems(prev => {
      const newCart = { ...prev };
      const currentQuantity = newCart[item.id] ? newCart[item.id].quantity : 0;
      const newQuantity = currentQuantity + change;

      if (newQuantity > 0) {
        newCart[item.id] = { ...item, quantity: newQuantity };
      } else {
        delete newCart[item.id];
      }
      return newCart;
    });
  };

  const moveToSavedForLater = (item) => {
    setCartItems(prevCart => {
      const newCart = { ...prevCart };
      delete newCart[item.id]; // Remove all quantity from cart
      return newCart;
    });
    setSavedForLaterItems(prevSaved => {
      const newSaved = { ...prevSaved };
      // If item already exists in saved, add quantity, otherwise add new item
      newSaved[item.id] = { ...item, quantity: (newSaved[item.id]?.quantity || 0) + item.quantity };
      return newSaved;
    });
  };

  const moveToCartFromSaved = (item, quantityToMove = item.quantity) => {
    setSavedForLaterItems(prevSaved => {
      const newSaved = { ...prevSaved };
      if (newSaved[item.id]) {
        newSaved[item.id].quantity -= quantityToMove;
        if (newSaved[item.id].quantity <= 0) {
          delete newSaved[item.id];
        }
      }
      return newSaved;
    });
    setCartItems(prevCart => {
      const newCart = { ...prevCart };
      newCart[item.id] = { ...item, quantity: (newCart[item.id]?.quantity || 0) + quantityToMove };
      return newCart;
    });
  };

  const filteredItems = predefinedItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const cartAsList = Object.values(cartItems);
  const totalItemsInCart = cartAsList.reduce((sum, item) => sum + item.quantity, 0);
  
  // Create a flat list of items for the packing algorithm
  const flatItemList = cartAsList.flatMap(item => Array(item.quantity).fill(item));
  
  // Calculate packing for the single optimal strategy
  const optimalMetrics = useMemo(() => calculateMetrics(packOptimal(flatItemList, AMAZON_BOX_SIZES), flatItemList), [flatItemList]);

  // Convert savedForLaterItems object to a map for suggestions (already a map, but ensuring structure)
  const savedForLaterItemsMap = savedForLaterItems;
  const bulkOrderSuggestions = useMemo(() => 
    getBulkOrderSuggestions(flatItemList, savedForLaterItemsMap, AMAZON_BOX_SIZES), 
    [flatItemList, savedForLaterItemsMap]
  );

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        <header className="bg-gradient-to-r from-[#232F3E] to-[#131921] p-6 text-white text-center rounded-t-xl">
          <h1 className="text-3xl sm:text-4xl font-bold flex items-center justify-center gap-3">
            <Leaf className="w-8 h-8 sm:w-10 sm:h-10 text-[#FF9900]" />
            <span>Smart Cart <span className="text-[#FF9900]">Sustainability</span> Optimizer</span>
          </h1>
          <p className="mt-2 text-lg sm:text-xl opacity-90">Search for products to optimize your delivery.</p>
        </header>

        {/* Changed lg:grid-cols-5 to lg:grid-cols-10 for more granular control */}
        <main className="p-6 sm:p-8 lg:p-10 grid grid-cols-1 lg:grid-cols-10 gap-8">
          {/* Left Column: Products & Search */}
          {/* Changed from lg:col-span-2 to lg:col-span-3 to make it slightly wider */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            <section>
              <h2 className="text-2xl font-bold text-[#131921] mb-4 flex items-center gap-2">
                <Search className="w-6 h-6 text-[#007185]" /> Find Products
              </h2>
              <input
                type="text"
                placeholder="Search for items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9900] focus:border-transparent"
              />
            </section>
            <section className="bg-gray-50 p-4 rounded-lg shadow-inner border flex-grow">
              {/* Changed to a single column list layout */}
              <div className="grid grid-cols-1 gap-3 max-h-[500px] overflow-y-auto pr-2">
                {filteredItems.map(item => (
                  <div key={item.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 flex items-center"> {/* Changed to flex items-center for horizontal layout */}
                    {/* Removed item icons */}
                    <div className="flex-grow"> {/* Added div to wrap name and dimensions */}
                        <span className="font-semibold text-[#007185] text-sm block">{item.name}</span> {/* block for new line */}
                        <span className="text-xs text-gray-500">{`${item.length}x${item.width}x${item.height} cm, ${item.weight} kg`}</span>
                    </div>
                    <button onClick={() => handleUpdateQuantity(item, 1)} className="ml-auto bg-[#FF9900] text-white font-bold py-1.5 px-3 rounded-lg hover:bg-[#E68A00] transition-colors flex items-center justify-center gap-1 text-sm">
                       <PlusCircle size={14} /> Add
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Middle Column: Cart & Saved for Later */}
          {/* Changed from lg:col-span-2 to lg:col-span-4 to make it wider */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <section className="bg-green-50 p-4 rounded-lg shadow-inner border-2 border-dashed border-green-300 flex-grow">
              <h2 className="text-2xl font-bold text-green-800 mb-4 flex items-center gap-2">
                <ShoppingBag className="w-6 h-6" /> Your Cart ({totalItemsInCart})
              </h2>
              {cartAsList.length === 0 ? (
                <p className="text-gray-600 italic text-center my-auto">Add items from the list.</p>
              ) : (
                <ul className="space-y-3 overflow-y-auto pr-2"> {/* Removed max-h-[200px] */}
                  {cartAsList.map(item => (
                    <li key={item.id} className="flex items-center bg-white p-2 rounded-md shadow-sm border">
                      <img src={item.imageUrl} alt={item.name} className="w-12 h-12 object-contain rounded mr-3" onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/48x48/CCCCCC/000000?text=Item"; }} />
                      <div className="flex-grow">
                        <span className="text-gray-800 font-medium text-sm">{item.name}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <button onClick={() => handleUpdateQuantity(item, -1)} className="text-gray-600 hover:text-red-600"><MinusCircle size={20} /></button>
                          <span className="font-bold text-md">{item.quantity}</span>
                          <button onClick={() => handleUpdateQuantity(item, 1)} className="text-gray-600 hover:text-green-600"><PlusCircle size={20} /></button>
                        </div>
                      </div>
                       <button onClick={() => moveToSavedForLater(item)} className="text-blue-400 hover:text-blue-600 ml-2" title="Save for Later">
                         <Bookmark size={18} />
                       </button>
                       <button onClick={() => handleUpdateQuantity(item, -item.quantity)} className="text-red-400 hover:text-red-600 ml-2" title="Remove all">
                         <Trash2 size={18} />
                       </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="bg-blue-50 p-4 rounded-lg shadow-inner border-2 border-dashed border-blue-300 flex-grow">
                <h2 className="text-2xl font-bold text-blue-800 mb-4 flex items-center gap-2">
                    <Bookmark className="w-6 h-6" /> Saved for Later ({Object.values(savedForLaterItems).reduce((sum, item) => sum + item.quantity, 0)})
                </h2>
                {Object.keys(savedForLaterItems).length === 0 ? (
                    <p className="text-gray-600 italic text-center my-auto">No items saved for later.</p>
                ) : (
                    <ul className="space-y-3 overflow-y-auto pr-2"> {/* Removed max-h-[200px] */}
                        {Object.values(savedForLaterItems).map(item => (
                            <li key={item.id} className="flex items-center bg-white p-2 rounded-md shadow-sm border">
                                <img src={item.imageUrl} alt={item.name} className="w-12 h-12 object-contain rounded mr-3" onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/48x48/CCCCCC/000000?text=Item"; }} />
                                <div className="flex-grow">
                                    <span className="text-gray-800 font-medium text-sm">{item.name}</span>
                                    <span className="text-xs text-gray-500 block">{item.quantity} item(s)</span>
                                </div>
                                <button onClick={() => moveToCartFromSaved(item)} className="text-green-400 hover:text-green-600 ml-2" title="Move to Cart">
                                    <ShoppingBag size={18} />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
          </div>

          {/* Right Column: Metrics & Visualization for Optimal approach */}
          {/* Changed from lg:col-span-2 to lg:col-span-3 to make it slightly less wide */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            <section className="bg-gray-50 p-4 rounded-lg shadow-inner border">
                <h2 className="text-2xl font-bold text-[#131921] mb-4">Optimal Shipment Plan</h2>
                <PackingVisualization title="Optimized for Sustainability" metrics={optimalMetrics} />
            </section>

            <section className="bg-yellow-50 p-4 rounded-lg shadow-inner border border-yellow-200 flex-grow">
                <h2 className="text-2xl font-bold text-yellow-800 mb-4 flex items-center gap-2">
                    <Info className="w-6 h-6" /> Bulk Order Suggestion
                </h2>
                {bulkOrderSuggestions.length === 0 ? (
                    <p className="text-gray-600 italic">No immediate bulk order suggestions from saved items found. Try adding more items to cart or saving more for later!</p>
                ) : (
                    <div className="space-y-3">
                        <p className="text-gray-700">Consider adding these saved items to your current order for better sustainability:</p>
                        {bulkOrderSuggestions.map((suggestion, index) => (
                            <div key={index} className={`p-3 rounded-md shadow-sm border ${suggestion.type === 'tooBig' ? 'bg-red-100 border-red-200 text-red-800' : 'bg-white'}`}>
                                <p className="font-semibold text-gray-800">Add {suggestion.item.name} ({suggestion.item.quantity} item(s))</p>
                                {suggestion.type === 'suggestion' ? (
                                    <p className="text-sm text-gray-600 mt-1">
                                        {suggestion.fewerBoxes && `This could reduce your total boxes from ${suggestion.oldTotalBoxes} to ${suggestion.newTotalBoxes}! `}
                                        {suggestion.efficiencyImprovement > 0.1 && `Increase packaging efficiency by ${suggestion.efficiencyImprovement.toFixed(1)}%. `}
                                        {suggestion.co2SavedByCombining > 0.01 && <span className="text-green-700 font-semibold">Save ~{suggestion.co2SavedByCombining.toFixed(2)} kg CO₂.</span>}
                                    </p>
                                ) : (
                                    <p className="text-sm text-red-700 mt-1 font-medium">{suggestion.message}</p>
                                )}
                                {suggestion.type === 'suggestion' && (
                                    <button onClick={() => moveToCartFromSaved(suggestion.item, suggestion.quantityToSuggest)} className="mt-2 bg-green-600 text-white font-bold py-1.5 px-3 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm">
                                        <PlusCircle size={16} /> Add {suggestion.quantityToSuggest} to Cart
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
