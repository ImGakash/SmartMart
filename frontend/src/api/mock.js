import { ApiError } from './client.js';

// ==========================================
// 1. FROZEN SEED DATA (from CONTRACT.md §4)
// ==========================================

export const MOCK_STORES = [
  {
    id: '20000000-0000-4000-8000-000000000001',
    storeCode: 'BLR-01',
    storeName: 'SmartMart Indiranagar',
    city: 'Bengaluru',
    state: 'Karnataka',
    address: '100 Feet Rd, Indiranagar, Bengaluru',
  },
  {
    id: '20000000-0000-4000-8000-000000000002',
    storeCode: 'BLR-02',
    storeName: 'SmartMart Koramangala',
    city: 'Bengaluru',
    state: 'Karnataka',
    address: '80 Feet Rd, 4th Block, Koramangala, Bengaluru',
  },
  {
    id: '20000000-0000-4000-8000-000000000003',
    storeCode: 'MUM-01',
    storeName: 'SmartMart Bandra',
    city: 'Mumbai',
    state: 'Maharashtra',
    address: 'Hill Road, Bandra West, Mumbai',
  },
  {
    id: '20000000-0000-4000-8000-000000000004',
    storeCode: 'DEL-01',
    storeName: 'SmartMart Connaught Place',
    city: 'Delhi',
    state: 'Delhi',
    address: 'Inner Circle, CP, New Delhi',
  },
  {
    id: '20000000-0000-4000-8000-000000000005',
    storeCode: 'HYD-01',
    storeName: 'SmartMart Hitec City',
    city: 'Hyderabad',
    state: 'Telangana',
    address: 'Madhapur Main Rd, Hitec City, Hyderabad',
  },
  {
    id: '20000000-0000-4000-8000-000000000006',
    storeCode: 'CHE-01',
    storeName: 'SmartMart T Nagar',
    city: 'Chennai',
    state: 'Tamil Nadu',
    address: 'Usman Rd, T Nagar, Chennai',
  },
];

// Seeded customers (60 Indian names, c01-c60)
const CUSTOMER_NAMES = [
  'Asha Rao', 'Vikram Malhotra', 'Priya Sharma', 'Arjun Patel', 'Neha Gupta',
  'Rohan Mehta', 'Ananya Iyer', 'Karan Verma', 'Pooja Nair', 'Aditya Singh',
  'Deepika Joshi', 'Siddharth Roy', 'Sneha Kulkarni', 'Manish Reddy', 'Kavita Das',
  'Rahul Jain', 'Divya Menon', 'Gaurav Choudhury', 'Ritu Pillai', 'Nikhil Saxena',
  'Swati Bose', 'Varun Bhat', 'Tanvi Deshmukh', 'Amitabh Sen', 'Isha Tiwari',
  'Harish Nambiar', 'Meera Bhattacharya', 'Pranav Hegde', 'Shruti Agarwal', 'Sameer Kapoor',
  'Sunita Rao', 'Kunal Merchant', 'Aparna Murthy', 'Chirag Sethi', 'Lavanya Natarajan',
  'Rajesh Pandey', 'Shreya Banerjee', 'Abhishek Kaul', 'Pallavi Ranganathan', 'Tarun Mittal',
  'Anita Somani', 'Vinay Pai', 'Simran Dhillon', 'Mohit Rawat', 'Preeti Devan',
  'Anil Ghosh', 'Radhika Swaminathan', 'Suresh Acharya', 'Vidya Sridhar', 'Mayank Chawla',
  'Gayatri Nene', 'Alok Goel', 'Bhavna Lal', 'Hemant Kamat', 'Namrata Nadkarni',
  'Vivek Subramanian', 'Archana Kamath', 'Ramesh Nayak', 'Geeta Prabhakar', 'Sanjay Bhatt'
];

export const MOCK_CUSTOMERS = CUSTOMER_NAMES.map((name, index) => {
  const num = String(index + 1).padStart(2, '0');
  return {
    id: `30000000-0000-4000-8000-0000000000${num}`,
    name,
    email: `c${num}@demo.smartmart.in`,
    city: 'Bengaluru',
  };
});

// 36 Catalog products across 5 categories
const RAW_PRODUCTS = [
  // 1-3 Fixed demo products
  {
    sku: 'SM-AUD-001',
    name: 'boAt Airdopes 141 Bluetooth Earphones',
    brand: 'boAt',
    category: 'Audio',
    pricePaise: 129900,
    imageUrl: '/products/boat-airdopes-141.jpg',
    description: 'boAt Airdopes 141 true wireless earbuds with 42H playtime, Beast mode for gaming, ENx tech, fast charge.',
    stock: { 'BLR-01': 1, 'BLR-02': 0, 'MUM-01': 0, 'DEL-01': 0, 'HYD-01': 0, 'CHE-01': 0 }
  },
  {
    sku: 'SM-ELE-002',
    name: 'Samsung Galaxy Watch4 Smartwatch',
    brand: 'Samsung',
    category: 'Electronics',
    pricePaise: 2999900,
    imageUrl: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=600&auto=format&fit=crop&q=80',
    description: 'Samsung Galaxy Watch4 with body composition analysis, ECG, sleep tracking, and Wear OS.',
    stock: { 'BLR-01': 10, 'BLR-02': 8, 'MUM-01': 15, 'DEL-01': 12, 'HYD-01': 6, 'CHE-01': 4 }
  },
  {
    sku: 'SM-APP-003',
    name: 'Eureka Forbes Vacuum Cleaner',
    brand: 'Eureka Forbes',
    category: 'Appliances',
    pricePaise: 499900,
    imageUrl: 'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=600&auto=format&fit=crop&q=80',
    description: 'Quick Clean DX dry vacuum cleaner with powerful 1200W suction, dust bag full indicator, multiple accessories.',
    stock: { 'BLR-01': 5, 'BLR-02': 3, 'MUM-01': 8, 'DEL-01': 4, 'HYD-01': 7, 'CHE-01': 2 }
  },
  // 4-10 Audio
  {
    sku: 'SM-AUD-004',
    name: 'Sony WH-1000XM4 Wireless Headphones',
    brand: 'Sony',
    category: 'Audio',
    pricePaise: 2299000,
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
    description: 'Industry leading active noise cancelling bluetooth headphones with 30-hour battery life and touch controls.',
    stock: { 'BLR-01': 7, 'BLR-02': 4, 'MUM-01': 10, 'DEL-01': 8, 'HYD-01': 5, 'CHE-01': 3 }
  },
  {
    sku: 'SM-AUD-005',
    name: 'JBL Flip 6 Portable Bluetooth Speaker',
    brand: 'JBL',
    category: 'Audio',
    pricePaise: 899900,
    imageUrl: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&auto=format&fit=crop&q=80',
    description: 'Eco-friendly packaging, 2-way speaker system with booming bass, IP67 waterproof and dustproof.',
    stock: { 'BLR-01': 12, 'BLR-02': 9, 'MUM-01': 14, 'DEL-01': 11, 'HYD-01': 8, 'CHE-01': 6 }
  },
  {
    sku: 'SM-AUD-006',
    name: 'Noise Buds VS102 Wireless Earbuds',
    brand: 'Noise',
    category: 'Audio',
    pricePaise: 109900,
    imageUrl: 'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=600&auto=format&fit=crop&q=80',
    description: 'Flybird design, 50-hour battery, Instacharge 10 min = 120 min play, dedicated gaming low-latency mode.',
    stock: { 'BLR-01': 18, 'BLR-02': 14, 'MUM-01': 22, 'DEL-01': 19, 'HYD-01': 12, 'CHE-01': 9 }
  },
  // 7-14 Electronics
  {
    sku: 'SM-ELE-007',
    name: 'Apple iPad 10th Gen 64GB Wi-Fi',
    brand: 'Apple',
    category: 'Electronics',
    pricePaise: 3490000,
    imageUrl: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&auto=format&fit=crop&q=80',
    description: '10.9-inch Liquid Retina display, A14 Bionic chip, 12MP Ultra Wide front camera with Center Stage.',
    stock: { 'BLR-01': 6, 'BLR-02': 5, 'MUM-01': 8, 'DEL-01': 7, 'HYD-01': 4, 'CHE-01': 2 }
  },
  {
    sku: 'SM-ELE-008',
    name: 'Logitech MX Master 3S Wireless Mouse',
    brand: 'Logitech',
    category: 'Electronics',
    pricePaise: 849500,
    imageUrl: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=600&auto=format&fit=crop&q=80',
    description: 'Quiet clicks, 8K DPI track-on-glass sensor, MagSpeed scrolling, ergonomic comfort grip.',
    stock: { 'BLR-01': 11, 'BLR-02': 8, 'MUM-01': 16, 'DEL-01': 10, 'HYD-01': 7, 'CHE-01': 5 }
  },
  {
    sku: 'SM-ELE-009',
    name: 'OnePlus Nord CE 3 Lite 5G 128GB',
    brand: 'OnePlus',
    category: 'Electronics',
    pricePaise: 1749900,
    imageUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02560?w=600&auto=format&fit=crop&q=80',
    description: '108MP camera, 67W SuperVOOC fast charging, 120Hz smooth display, dual stereo speakers.',
    stock: { 'BLR-01': 15, 'BLR-02': 11, 'MUM-01': 20, 'DEL-01': 18, 'HYD-01': 14, 'CHE-01': 8 }
  },
  {
    sku: 'SM-ELE-010',
    name: 'SanDisk 1TB Extreme Portable SSD',
    brand: 'SanDisk',
    category: 'Electronics',
    pricePaise: 949900,
    imageUrl: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=600&auto=format&fit=crop&q=80',
    description: 'NVMe solid state performance with 1050MB/s read, 1000MB/s write speeds, rugged IP55 water/dust resistance.',
    stock: { 'BLR-01': 9, 'BLR-02': 6, 'MUM-01': 12, 'DEL-01': 8, 'HYD-01': 5, 'CHE-01': 4 }
  },
  // 11-18 Appliances
  {
    sku: 'SM-APP-011',
    name: 'Philips Daily Collection Air Fryer',
    brand: 'Philips',
    category: 'Appliances',
    pricePaise: 699900,
    imageUrl: 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=600&auto=format&fit=crop&q=80',
    description: 'Rapid Air technology for 90% less fat cooking, 4.1L basket capacity, easy clean dishwasher-safe parts.',
    stock: { 'BLR-01': 8, 'BLR-02': 5, 'MUM-01': 11, 'DEL-01': 9, 'HYD-01': 6, 'CHE-01': 3 }
  },
  {
    sku: 'SM-APP-012',
    name: 'Bajaj New Shakti 15L Storage Water Heater',
    brand: 'Bajaj',
    category: 'Appliances',
    pricePaise: 549900,
    imageUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600&auto=format&fit=crop&q=80',
    description: 'Titanium armour technology, swirl flow 20% more hot water, 8 bar pressure suitable for high-rise buildings.',
    stock: { 'BLR-01': 4, 'BLR-02': 3, 'MUM-01': 7, 'DEL-01': 10, 'HYD-01': 4, 'CHE-01': 2 }
  },
  {
    sku: 'SM-APP-013',
    name: 'Prestige Iris Plus 750W Mixer Grinder',
    brand: 'Prestige',
    category: 'Appliances',
    pricePaise: 319900,
    imageUrl: 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=600&auto=format&fit=crop&q=80',
    description: '3 stainless steel jars + transparent juicer jar, powerful motor with overload protector, ergonomic handles.',
    stock: { 'BLR-01': 14, 'BLR-02': 10, 'MUM-01': 18, 'DEL-01': 15, 'HYD-01': 12, 'CHE-01': 11 }
  },
  // 14-25 Footwear
  {
    sku: 'SM-FTW-014',
    name: 'Puma Men Velocity Nitro 2 Running Shoes',
    brand: 'Puma',
    category: 'Footwear',
    pricePaise: 549900,
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80',
    description: 'Nitro foam cushioning, durable Pumagrip rubber outsole, engineered mesh upper with reflective accents.',
    stock: { 'BLR-01': 10, 'BLR-02': 8, 'MUM-01': 12, 'DEL-01': 14, 'HYD-01': 7, 'CHE-01': 5 }
  },
  {
    sku: 'SM-FTW-015',
    name: 'Woodland Camel Casual Leather Boots',
    brand: 'Woodland',
    category: 'Footwear',
    pricePaise: 429500,
    imageUrl: 'https://images.unsplash.com/photo-1520639888713-7851133b1ed0?w=600&auto=format&fit=crop&q=80',
    description: 'High-ankle nubuck leather outdoor boots with grooved rugged rubber sole for all-terrain traction.',
    stock: { 'BLR-01': 6, 'BLR-02': 4, 'MUM-01': 9, 'DEL-01': 11, 'HYD-01': 5, 'CHE-01': 3 }
  },
  {
    sku: 'SM-FTW-016',
    name: 'Red Tape Men Walking Sneaker Shoes',
    brand: 'Red Tape',
    category: 'Footwear',
    pricePaise: 169900,
    imageUrl: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600&auto=format&fit=crop&q=80',
    description: 'Air cushion memory foam insole, breathable mesh upper, lightweight flexible EVA sole.',
    stock: { 'BLR-01': 16, 'BLR-02': 12, 'MUM-01': 20, 'DEL-01': 18, 'HYD-01': 13, 'CHE-01': 9 }
  },
  {
    sku: 'SM-FTW-017',
    name: 'Campus Men North Plus Running Shoes',
    brand: 'Campus',
    category: 'Footwear',
    pricePaise: 129900,
    imageUrl: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=600&auto=format&fit=crop&q=80',
    description: 'PilloFoam tech for soft landings, knitted vamp for ventilation, slip-resistant sports bottom.',
    stock: { 'BLR-01': 22, 'BLR-02': 18, 'MUM-01': 25, 'DEL-01': 22, 'HYD-01': 15, 'CHE-01': 12 }
  },
  // 18-28 Apparel
  {
    sku: 'SM-APP-018',
    name: 'Allen Solly Men Slim Fit Casual Shirt',
    brand: 'Allen Solly',
    category: 'Apparel',
    pricePaise: 119900,
    imageUrl: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&auto=format&fit=crop&q=80',
    description: '100% premium cotton, button-down collar, enzyme washed for supreme softness.',
    stock: { 'BLR-01': 15, 'BLR-02': 12, 'MUM-01': 20, 'DEL-01': 18, 'HYD-01': 11, 'CHE-01': 8 }
  },
  {
    sku: 'SM-APP-019',
    name: 'Levi\'s 511 Slim Fit Denim Jeans',
    brand: 'Levi\'s',
    category: 'Apparel',
    pricePaise: 279900,
    imageUrl: 'https://images.unsplash.com/photo-1542272604-780c96856592?w=600&auto=format&fit=crop&q=80',
    description: 'Classic 5-pocket styling, stretch denim blend, zip fly, iconic red tab back pocket.',
    stock: { 'BLR-01': 11, 'BLR-02': 8, 'MUM-01': 15, 'DEL-01': 16, 'HYD-01': 9, 'CHE-01': 6 }
  },
  {
    sku: 'SM-APP-020',
    name: 'Fabindia Cotton Straight Kurta',
    brand: 'Fabindia',
    category: 'Apparel',
    pricePaise: 189000,
    imageUrl: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&auto=format&fit=crop&q=80',
    description: 'Handcrafted woven cotton kurta with Chinese collar, side pockets, knee-length comfort wear.',
    stock: { 'BLR-01': 14, 'BLR-02': 11, 'MUM-01': 16, 'DEL-01': 19, 'HYD-01': 10, 'CHE-01': 8 }
  },
  {
    sku: 'SM-APP-021',
    name: 'Van Heusen Men Formal Trouser',
    brand: 'Van Heusen',
    category: 'Apparel',
    pricePaise: 169900,
    imageUrl: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=600&auto=format&fit=crop&q=80',
    description: 'Poly-viscose wrinkle-free formal trouser, flat front, stretch waistband comfort.',
    stock: { 'BLR-01': 9, 'BLR-02': 7, 'MUM-01': 14, 'DEL-01': 15, 'HYD-01': 8, 'CHE-01': 6 }
  },
  // 22-36 Extra variety
  {
    sku: 'SM-ELE-022',
    name: 'boAt Wave Call 2 Bluetooth Smartwatch',
    brand: 'boAt',
    category: 'Electronics',
    pricePaise: 149900,
    imageUrl: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600&auto=format&fit=crop&q=80',
    description: '1.83 inch HD display, bluetooth calling with dial pad, 700+ active sports modes, IP67.',
    stock: { 'BLR-01': 20, 'BLR-02': 16, 'MUM-01': 22, 'DEL-01': 19, 'HYD-01': 14, 'CHE-01': 10 }
  },
  {
    sku: 'SM-AUD-023',
    name: 'Marshall Emberton II Bluetooth Speaker',
    brand: 'Marshall',
    category: 'Audio',
    pricePaise: 1499900,
    imageUrl: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600&auto=format&fit=crop&q=80',
    description: 'True Stereophonic multi-directional 360 sound, 30+ hours playtime, IP67 dust/water resistance.',
    stock: { 'BLR-01': 5, 'BLR-02': 3, 'MUM-01': 8, 'DEL-01': 6, 'HYD-01': 4, 'CHE-01': 2 }
  },
  {
    sku: 'SM-APP-024',
    name: 'Havells Instanio 3-Litre Instant Geyser',
    brand: 'Havells',
    category: 'Appliances',
    pricePaise: 369900,
    imageUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600&auto=format&fit=crop&q=80',
    description: 'Rust and shock-proof ABS body, color-changing LED indicator for hot water readiness, 3000W.',
    stock: { 'BLR-01': 6, 'BLR-02': 5, 'MUM-01': 10, 'DEL-01': 12, 'HYD-01': 7, 'CHE-01': 3 }
  },
  {
    sku: 'SM-FTW-025',
    name: 'Bata Men Comfit Memory Foam Loafers',
    brand: 'Bata',
    category: 'Footwear',
    pricePaise: 189900,
    imageUrl: 'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=600&auto=format&fit=crop&q=80',
    description: 'Genuine leather slip-on formal loafers with cushioned memory foam arch support.',
    stock: { 'BLR-01': 14, 'BLR-02': 10, 'MUM-01': 16, 'DEL-01': 15, 'HYD-01': 9, 'CHE-01': 7 }
  },
  {
    sku: 'SM-APP-026',
    name: 'Peter England Men Regular Fit Blazer',
    brand: 'Peter England',
    category: 'Apparel',
    pricePaise: 449900,
    imageUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&auto=format&fit=crop&q=80',
    description: 'Single-breasted 2-button notch lapel blazer in rich textured navy blend.',
    stock: { 'BLR-01': 7, 'BLR-02': 4, 'MUM-01': 10, 'DEL-01': 11, 'HYD-01': 5, 'CHE-01': 3 }
  },
  {
    sku: 'SM-ELE-027',
    name: 'Amazon Echo Dot 5th Gen with Alexa',
    brand: 'Amazon',
    category: 'Electronics',
    pricePaise: 449900,
    imageUrl: 'https://images.unsplash.com/photo-1543512214-318c7553f230?w=600&auto=format&fit=crop&q=80',
    description: 'Deeper bass and clearer vocals smart speaker with motion detection and temperature sensor.',
    stock: { 'BLR-01': 15, 'BLR-02': 11, 'MUM-01': 18, 'DEL-01': 16, 'HYD-01': 12, 'CHE-01': 8 }
  },
  {
    sku: 'SM-APP-028',
    name: 'Crompton Ozone 75 Desert Air Cooler',
    brand: 'Crompton',
    category: 'Appliances',
    pricePaise: 999900,
    imageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80',
    description: '75L water tank with honeycomb cooling pads, 4-way air deflection, inverter compatible.',
    stock: { 'BLR-01': 5, 'BLR-02': 3, 'MUM-01': 6, 'DEL-01': 15, 'HYD-01': 8, 'CHE-01': 6 }
  },
  {
    sku: 'SM-AUD-029',
    name: 'Realme Buds Air 5 Pro ANC Earbuds',
    brand: 'Realme',
    category: 'Audio',
    pricePaise: 499900,
    imageUrl: '/products/boat-airdopes-141.jpg',
    description: '50dB active noise cancellation, Hi-Res audio certified, 11mm bass driver + 6mm planar tweeter.',
    stock: { 'BLR-01': 12, 'BLR-02': 9, 'MUM-01': 15, 'DEL-01': 14, 'HYD-01': 10, 'CHE-01': 7 }
  },
  {
    sku: 'SM-FTW-030',
    name: 'Crocs Classic Unisex Clogs',
    brand: 'Crocs',
    category: 'Footwear',
    pricePaise: 299500,
    imageUrl: 'https://images.unsplash.com/photo-1562183241-b937e95585b6?w=600&auto=format&fit=crop&q=80',
    description: 'Iconic Croslite comfort, pivoting heel straps, ventilation ports that shed water and debris.',
    stock: { 'BLR-01': 18, 'BLR-02': 14, 'MUM-01': 22, 'DEL-01': 19, 'HYD-01': 12, 'CHE-01': 10 }
  },
  {
    sku: 'SM-APP-031',
    name: 'Wrangler Men Graphic Print T-Shirt',
    brand: 'Wrangler',
    category: 'Apparel',
    pricePaise: 79900,
    imageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80',
    description: 'Bio-washed combed cotton crew neck tee with vintage distressed chest graphic.',
    stock: { 'BLR-01': 25, 'BLR-02': 20, 'MUM-01': 30, 'DEL-01': 28, 'HYD-01': 19, 'CHE-01': 15 }
  },
  {
    sku: 'SM-ELE-032',
    name: 'TP-Link Deco S7 Mesh Wi-Fi System',
    brand: 'TP-Link',
    category: 'Electronics',
    pricePaise: 799900,
    imageUrl: 'https://images.unsplash.com/photo-1544717302-de2939b7ef71?w=600&auto=format&fit=crop&q=80',
    description: 'AC1900 whole home mesh Wi-Fi 3-pack covers up to 5,600 sq.ft with seamless roaming.',
    stock: { 'BLR-01': 6, 'BLR-02': 4, 'MUM-01': 8, 'DEL-01': 7, 'HYD-01': 5, 'CHE-01': 3 }
  },
  {
    sku: 'SM-APP-033',
    name: 'Morphy Richards 24L Convection Microwave',
    brand: 'Morphy Richards',
    category: 'Appliances',
    pricePaise: 1149900,
    imageUrl: 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=600&auto=format&fit=crop&q=80',
    description: 'Stainless steel cavity, auto cook menus, motorized rotisserie for tandoori cooking.',
    stock: { 'BLR-01': 5, 'BLR-02': 3, 'MUM-01': 6, 'DEL-01': 8, 'HYD-01': 4, 'CHE-01': 2 }
  },
  {
    sku: 'SM-AUD-034',
    name: 'Sennheiser HD 400S Over-Ear Headphones',
    brand: 'Sennheiser',
    category: 'Audio',
    pricePaise: 399000,
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
    description: 'Renowned Sennheiser acoustics with dynamic bass response, integrated smart remote for calls.',
    stock: { 'BLR-01': 8, 'BLR-02': 6, 'MUM-01': 10, 'DEL-01': 9, 'HYD-01': 5, 'CHE-01': 4 }
  },
  {
    sku: 'SM-FTW-035',
    name: 'Skechers Men Go Walk Max Walking Shoes',
    brand: 'Skechers',
    category: 'Footwear',
    pricePaise: 379900,
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80',
    description: '5GEN sole cushioning, Goga Max high-rebound insole, super lightweight slip-on comfort design.',
    stock: { 'BLR-01': 11, 'BLR-02': 8, 'MUM-01': 14, 'DEL-01': 12, 'HYD-01': 8, 'CHE-01': 5 }
  },
  {
    sku: 'SM-APP-036',
    name: 'W for Woman Printed Straight Cotton Kurti',
    brand: 'W for Woman',
    category: 'Apparel',
    pricePaise: 149900,
    imageUrl: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&auto=format&fit=crop&q=80',
    description: 'Keyhole neck with metallic trim, geometrical gold foil print, side slits, 3/4 sleeves.',
    stock: { 'BLR-01': 16, 'BLR-02': 12, 'MUM-01': 20, 'DEL-01': 18, 'HYD-01': 11, 'CHE-01': 9 }
  },
];

// Enrich products with exact contract UUIDs
export const MOCK_PRODUCTS = RAW_PRODUCTS.map((p, idx) => {
  const num = String(idx + 1).padStart(2, '0');
  const id = `10000000-0000-4000-8000-0000000000${num}`;

  // Build availability list for each store
  const availability = MOCK_STORES.map((s) => ({
    storeId: s.id,
    storeCode: s.storeCode,
    storeName: s.storeName,
    city: s.city,
    stockQty: p.stock[s.storeCode] ?? 0,
  }));

  const totalStock = availability.reduce((acc, curr) => acc + curr.stockQty, 0);
  const cities = [...new Set(availability.filter(a => a.stockQty > 0).map(a => a.city))];

  return {
    id,
    sku: p.sku,
    name: p.name,
    brand: p.brand,
    category: p.category,
    pricePaise: p.pricePaise,
    imageUrl: p.imageUrl,
    description: p.description,
    attributes: {},
    cities,
    availability,
    totalStock,
    indexedAt: new Date().toISOString(),
  };
});

// ==========================================
// 2. IN-MEMORY STATE FOR MOCK MUTATIONS
// ==========================================

// Map of `customerId:storeId` -> Cart
const cartsState = new Map();

// Map of orderId -> OrderWithItems + details
const ordersState = new Map();

// Map of idempotencyKey -> orderId
const idempotencyKeyMap = new Map();

// Live inventory clone that mutates on checkout / POS / race
export const inventoryState = new Map(); // key: `${storeId}:${productId}` -> stockQty

function initInventory() {
  inventoryState.clear();
  MOCK_PRODUCTS.forEach(p => {
    p.availability.forEach(a => {
      inventoryState.set(`${a.storeId}:${p.id}`, a.stockQty);
    });
  });
}
initInventory();

export function getStock(storeId, productId) {
  return inventoryState.get(`${storeId}:${productId}`) ?? 0;
}

export function setStock(storeId, productId, qty) {
  inventoryState.set(`${storeId}:${productId}`, Math.max(0, qty));
}

// In-memory chaos state
export const chaosState = {
  relay: false,
  'relay-after-publish': false,
  notifications: false,
  'search-indexer': false,
};

// ==========================================
// 3. CART HELPERS
// ==========================================

function getOrCreateCart(customerId, storeId) {
  const key = `${customerId}:${storeId}`;
  if (!cartsState.has(key)) {
    cartsState.set(key, {
      id: `cart-${customerId.slice(-4)}-${storeId.slice(-4)}`,
      customerId,
      storeId,
      status: 'ACTIVE',
      totalPaise: 0,
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  return cartsState.get(key);
}

function recalculateCart(cart) {
  let total = 0;
  cart.items.forEach(item => {
    item.subtotalPaise = item.unitPricePaise * item.quantity;
    total += item.subtotalPaise;
    item.stockQty = getStock(cart.storeId, item.productId);
  });
  cart.totalPaise = total;
  cart.updatedAt = new Date().toISOString();
  return cart;
}

// ==========================================
// 4. MOCK X-RAY BUNDLE BUILDER
// ==========================================

export function mockXRayBundle() {
  const totalOrders = ordersState.size + 142;
  const ordersList = Array.from(ordersState.values());

  const onlineOrders = ordersList.filter(o => o.source === 'ONLINE').length + 94;
  const posOrders = ordersList.filter(o => o.source === 'POS_STORE').length + 48;

  return {
    dashboard: {
      totalProducts: MOCK_PRODUCTS.length,
      totalStores: MOCK_STORES.length,
      totalOrders,
      ordersBySource: {
        ONLINE: onlineOrders,
        POS_STORE: posOrders,
      },
      totalNotifications: onlineOrders + 88,
      lowStockCount: 4,
      outbox: {
        pending: chaosState.relay ? 4 : 0,
        processing: chaosState['relay-after-publish'] ? 1 : 0,
        published: totalOrders * 2,
        failed: 0,
        oldestPendingAgeSeconds: chaosState.relay ? 14 : 0,
      },
    },
    inventoryByCity: [
      { city: 'Bengaluru', storeCount: 2, totalUnits: 1420, outOfStockSkus: 1 },
      { city: 'Mumbai', storeCount: 1, totalUnits: 980, outOfStockSkus: 0 },
      { city: 'Delhi', storeCount: 1, totalUnits: 1040, outOfStockSkus: 0 },
      { city: 'Hyderabad', storeCount: 1, totalUnits: 790, outOfStockSkus: 0 },
      { city: 'Chennai', storeCount: 1, totalUnits: 650, outOfStockSkus: 0 },
    ],
    lowStock: [
      { productId: MOCK_PRODUCTS[0].id, name: MOCK_PRODUCTS[0].name, storeCode: 'BLR-01', city: 'Bengaluru', stockQty: getStock(MOCK_STORES[0].id, MOCK_PRODUCTS[0].id) },
      { productId: MOCK_PRODUCTS[2].id, name: MOCK_PRODUCTS[2].name, storeCode: 'CHE-01', city: 'Chennai', stockQty: 2 },
      { productId: MOCK_PRODUCTS[6].id, name: MOCK_PRODUCTS[6].name, storeCode: 'CHE-01', city: 'Chennai', stockQty: 2 },
      { productId: MOCK_PRODUCTS[11].id, name: MOCK_PRODUCTS[11].name, storeCode: 'CHE-01', city: 'Chennai', stockQty: 2 },
    ],
    recentOrders: ordersList.slice(-10).reverse().map(o => ({
      id: o.id,
      orderNumber: o.orderNumber,
      source: o.source,
      status: o.status,
      totalPaise: o.totalPaise,
      storeCity: MOCK_STORES.find(s => s.id === o.storeId)?.city || 'Bengaluru',
      itemCount: o.items.length,
      createdAt: o.createdAt,
    })),
    recentNotifications: ordersList.filter(o => o.source === 'ONLINE').slice(-5).map(o => ({
      id: `notif-${o.id}`,
      orderId: o.id,
      channel: 'SIMULATED_EMAIL',
      message: `Order ${o.orderNumber} confirmed: ${o.items.length} item(s), ₹${(o.totalPaise / 100).toFixed(2)}. Thank you for shopping with SmartMart!`,
      createdAt: o.createdAt,
    })),
    outbox: {
      pending: chaosState.relay ? 4 : 0,
      processing: chaosState['relay-after-publish'] ? 1 : 0,
      published: totalOrders * 2,
      failed: 0,
      oldestPendingAgeSeconds: chaosState.relay ? 14 : 0,
    },
    consistency: {
      checks: [
        { name: 'no_negative_stock', status: 'PASS', detail: '0 rows with stock_qty < 0' },
        { name: 'inventory_reconciliation', status: 'PASS', detail: 'baseline - sold == current for all (store, product)' },
        { name: 'order_totals_match', status: 'PASS', detail: 'order total equals sum of order_items subtotal' },
        { name: 'order_item_store_matches', status: 'PASS', detail: 'all items have matching store_id' },
        { name: 'outbox_order_orphans', status: 'PASS', detail: '0 orphan outbox events' },
        { name: 'no_duplicate_notifications', status: 'PASS', detail: 'unique constraint holds on (order_id, channel)' },
        { name: 'every_order_has_items', status: 'PASS', detail: 'all orders have >= 1 items' },
        { name: 'no_orphan_order_items', status: 'PASS', detail: '0 orphan items' },
        { name: 'outbox_drained', status: chaosState.relay ? 'FAIL' : 'PASS', detail: chaosState.relay ? '4 pending events in outbox' : '0 pending/processing events in normal operation' },
        { name: 'idempotency_unique', status: 'PASS', detail: '0 duplicate idempotency keys' },
      ],
    },
    reconciliation: (() => {
      const rows = MOCK_PRODUCTS.map((p) => {
        let pgTotalStock = 0;
        const pgCitiesSet = new Set();
        MOCK_STORES.forEach((s) => {
          const qty = getStock(s.id, p.id);
          pgTotalStock += qty;
          if (qty > 0) pgCitiesSet.add(s.city);
        });
        const pgCities = Array.from(pgCitiesSet);

        const isLagging = Boolean(chaosState['search-indexer']);
        const osTotalStock = isLagging ? Math.max(0, pgTotalStock + 2) : pgTotalStock;
        const osCities = isLagging ? ['Bengaluru', 'Mumbai'] : pgCities;

        let status = 'PASS';
        if (isLagging) {
          status = 'SYNCING';
        } else if (pgTotalStock !== osTotalStock) {
          status = 'FAIL';
        }

        return {
          productId: p.id,
          name: p.name,
          pgTotalStock,
          osTotalStock,
          pgCities,
          osCities,
          status,
        };
      });

      const mismatches = rows.filter((r) => r.status !== 'PASS').length;
      return {
        checkedAt: new Date().toISOString(),
        mismatches,
        rows,
      };
    })(),
    chaos: { ...chaosState },
  };
}

// ==========================================
// 5. MASTER ROUTER FOR MOCK CALLS
// ==========================================

export async function handleMockRequest(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const [pathname, queryString] = url.split('?');
  const params = new URLSearchParams(queryString || '');
  const headers = options.headers || {};
  const body = options.body;

  // Emulate slight realistic local latency (15-50ms)
  await new Promise(r => setTimeout(r, 20));

  // --- GET /health ---
  if (pathname === '/health' && method === 'GET') {
    return {
      pg: 'up',
      kafka: 'up',
      opensearch: 'up',
    };
  }

  // --- GET /stores ---
  if (pathname === '/stores' && method === 'GET') {
    return MOCK_STORES;
  }

  // --- GET /customers ---
  if (pathname === '/customers' && method === 'GET') {
    return MOCK_CUSTOMERS;
  }

  // --- GET /products ---
  if (pathname === '/products' && method === 'GET') {
    const category = params.get('category');
    let prods = MOCK_PRODUCTS;
    if (category) {
      prods = prods.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }
    const limit = parseInt(params.get('limit') || '50', 10);
    const offset = parseInt(params.get('offset') || '0', 10);
    return prods.slice(offset, offset + limit).map(p => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      brand: p.brand,
      category: p.category,
      pricePaise: p.pricePaise,
      imageUrl: p.imageUrl,
    }));
  }

  // --- GET /products/:id ---
  if (pathname.startsWith('/products/') && method === 'GET') {
    const productId = pathname.replace('/products/', '');
    const product = MOCK_PRODUCTS.find(p => p.id === productId);
    if (!product) {
      throw new ApiError('PRODUCT_NOT_FOUND', 'Product not found', { id: productId }, 404);
    }
    // Update live stock from inventoryState
    const updatedAvailability = product.availability.map(a => ({
      ...a,
      stockQty: getStock(a.storeId, product.id),
    }));
    return {
      ...product,
      availability: updatedAvailability,
      totalStock: updatedAvailability.reduce((sum, a) => sum + a.stockQty, 0),
    };
  }

  // --- GET /search ---
  if (pathname === '/search' && method === 'GET') {
    const q = (params.get('q') || '').trim().toLowerCase();
    const category = params.get('category');
    const city = params.get('city');
    const minPaise = params.get('minPaise') ? parseInt(params.get('minPaise'), 10) : null;
    const maxPaise = params.get('maxPaise') ? parseInt(params.get('maxPaise'), 10) : null;
    const limit = parseInt(params.get('limit') || '50', 10);

    let hits = MOCK_PRODUCTS.map(p => {
      const liveAvailability = p.availability.map(a => ({
        ...a,
        stockQty: getStock(a.storeId, p.id),
      }));
      const liveCities = [...new Set(liveAvailability.filter(a => a.stockQty > 0).map(a => a.city))];
      const liveTotalStock = liveAvailability.reduce((s, a) => s + a.stockQty, 0);

      return {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        description: p.description,
        category: p.category,
        brand: p.brand,
        pricePaise: p.pricePaise,
        imageUrl: p.imageUrl,
        cities: liveCities,
        availability: liveAvailability,
        totalStock: liveTotalStock,
        indexedAt: p.indexedAt,
        highlight: {},
      };
    });

    // Query text match with typo tolerance for "bluetoth" -> boAt and "vacum" -> Eureka Forbes
    if (q) {
      hits = hits.filter(doc => {
        const text = `${doc.name} ${doc.description} ${doc.brand} ${doc.category}`.toLowerCase();
        if (text.includes(q)) return true;
        // Demo typo hooks
        if (q.includes('bluetoth') && doc.productId === MOCK_PRODUCTS[0].id) {
          doc.highlight.name = ['boAt Airdopes 141 <mark>Bluetooth</mark> Earphones'];
          return true;
        }
        if (q.includes('vacum') && doc.productId === MOCK_PRODUCTS[2].id) {
          doc.highlight.name = ['Eureka Forbes <mark>Vacuum</mark> Cleaner'];
          return true;
        }
        return false;
      });

      // Simple highlight generator for normal matches
      hits.forEach(doc => {
        if (!doc.highlight.name && doc.name.toLowerCase().includes(q)) {
          const reg = new RegExp(`(${q})`, 'gi');
          doc.highlight.name = [doc.name.replace(reg, '<mark>$1</mark>')];
        }
      });
    }

    if (category) {
      hits = hits.filter(h => h.category.toLowerCase() === category.toLowerCase());
    }

    if (city) {
      hits = hits.filter(h => h.cities.includes(city));
    }

    if (minPaise !== null) {
      hits = hits.filter(h => h.pricePaise >= minPaise);
    }

    if (maxPaise !== null) {
      hits = hits.filter(h => h.pricePaise <= maxPaise);
    }

    return {
      took: 4,
      total: hits.length,
      hits: hits.slice(0, limit),
    };
  }

  // --- CART ENDPOINTS (Requires X-Customer-Id) ---
  const customerId = headers['x-customer-id'] || headers['X-Customer-Id'];

  if (pathname === '/cart' && method === 'GET') {
    if (!customerId) {
      throw new ApiError('CUSTOMER_NOT_FOUND', 'Missing X-Customer-Id header', {}, 400);
    }
    const storeId = params.get('storeId') || MOCK_STORES[0].id;
    const cart = getOrCreateCart(customerId, storeId);
    return recalculateCart(cart);
  }

  if (pathname === '/cart/items' && method === 'POST') {
    if (!customerId) {
      throw new ApiError('CUSTOMER_NOT_FOUND', 'Missing X-Customer-Id header', {}, 400);
    }
    const { storeId, productId, quantity } = body || {};
    if (!storeId || !productId || !quantity || quantity <= 0) {
      throw new ApiError('INVALID_QUANTITY', 'Invalid quantity or payload', { productId, quantity }, 400);
    }
    const product = MOCK_PRODUCTS.find(p => p.id === productId);
    if (!product) {
      throw new ApiError('PRODUCT_NOT_FOUND', 'Product not found', { id: productId }, 404);
    }

    const cart = getOrCreateCart(customerId, storeId);
    const existing = cart.items.find(i => i.productId === productId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.items.push({
        productId,
        name: product.name,
        imageUrl: product.imageUrl,
        unitPricePaise: product.pricePaise,
        quantity,
        subtotalPaise: product.pricePaise * quantity,
        stockQty: getStock(storeId, productId),
      });
    }
    return recalculateCart(cart);
  }

  if (pathname.startsWith('/cart/items/') && method === 'PATCH') {
    if (!customerId) {
      throw new ApiError('CUSTOMER_NOT_FOUND', 'Missing X-Customer-Id header', {}, 400);
    }
    const productId = pathname.replace('/cart/items/', '');
    const { storeId, quantity } = body || {};
    if (!quantity || quantity <= 0) {
      throw new ApiError('INVALID_QUANTITY', 'Quantity must be > 0', { productId, quantity }, 400);
    }
    const cart = getOrCreateCart(customerId, storeId || MOCK_STORES[0].id);
    const item = cart.items.find(i => i.productId === productId);
    if (item) {
      item.quantity = quantity;
    }
    return recalculateCart(cart);
  }

  if (pathname.startsWith('/cart/items/') && method === 'DELETE') {
    if (!customerId) {
      throw new ApiError('CUSTOMER_NOT_FOUND', 'Missing X-Customer-Id header', {}, 400);
    }
    const productId = pathname.replace('/cart/items/', '');
    const storeId = params.get('storeId') || MOCK_STORES[0].id;
    const cart = getOrCreateCart(customerId, storeId);
    cart.items = cart.items.filter(i => i.productId !== productId);
    return recalculateCart(cart);
  }

  // --- POST /checkout ---
  if (pathname === '/checkout' && method === 'POST') {
    if (!customerId) {
      throw new ApiError('CUSTOMER_NOT_FOUND', 'Missing X-Customer-Id header', {}, 400);
    }
    const idempotencyKey = headers['idempotency-key'] || headers['Idempotency-Key'];
    if (!idempotencyKey) {
      throw new ApiError('INVALID_PAYLOAD', 'Missing Idempotency-Key header', {}, 400);
    }

    // Check idempotency replay
    if (idempotencyKeyMap.has(idempotencyKey)) {
      const existingOrderId = idempotencyKeyMap.get(idempotencyKey);
      const existingOrder = ordersState.get(existingOrderId);
      return {
        order: existingOrder,
        replayed: true,
      };
    }

    const { storeId, items: rawItems } = body || {};
    const effectiveStoreId = storeId || MOCK_STORES[0].id;
    const cart = getOrCreateCart(customerId, effectiveStoreId);

    const itemsToOrder = rawItems && rawItems.length > 0 ? rawItems : cart.items;

    if (!itemsToOrder || itemsToOrder.length === 0) {
      throw new ApiError('CART_EMPTY', 'Your cart is empty', {}, 400);
    }

    // Stock check & deduction
    for (const item of itemsToOrder) {
      const avail = getStock(effectiveStoreId, item.productId);
      if (avail < item.quantity) {
        throw new ApiError('INSUFFICIENT_STOCK', `Only ${avail} left — you asked for ${item.quantity}`, {
          productId: item.productId,
          storeId: effectiveStoreId,
          available: avail,
          requested: item.quantity,
        }, 409);
      }
    }

    // Deduct stock atomically
    for (const item of itemsToOrder) {
      const avail = getStock(effectiveStoreId, item.productId);
      setStock(effectiveStoreId, item.productId, avail - item.quantity);
    }

    const orderId = `order-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const orderNumber = `SM-${String(1000 + ordersState.size + 1).padStart(6, '0')}`;

    const orderItems = itemsToOrder.map(i => {
      const prod = MOCK_PRODUCTS.find(p => p.id === i.productId);
      const unitPricePaise = prod ? prod.pricePaise : (i.unitPricePaise || 10000);
      return {
        productId: i.productId,
        storeId: effectiveStoreId,
        quantity: i.quantity,
        unitPricePaise,
        subtotalPaise: unitPricePaise * i.quantity,
      };
    });

    const totalPaise = orderItems.reduce((acc, cur) => acc + cur.subtotalPaise, 0);

    const newOrder = {
      id: orderId,
      orderNumber,
      customerId,
      storeId: effectiveStoreId,
      source: 'ONLINE',
      status: 'CONFIRMED',
      totalPaise,
      idempotencyKey,
      createdAt: new Date().toISOString(),
      items: orderItems,
    };

    ordersState.set(orderId, newOrder);
    idempotencyKeyMap.set(idempotencyKey, orderId);

    // Clear cart
    cart.items = [];
    cart.totalPaise = 0;

    return {
      order: newOrder,
      replayed: false,
    };
  }

  // --- GET /orders/:id ---
  if (pathname.startsWith('/orders/') && !pathname.endsWith('/notifications') && !pathname.endsWith('/events') && method === 'GET') {
    const orderId = pathname.replace('/orders/', '');
    let order = ordersState.get(orderId);

    // If fresh page refresh on sample order, generate one dynamically
    if (!order) {
      order = {
        id: orderId,
        orderNumber: 'SM-001001',
        customerId: MOCK_CUSTOMERS[0].id,
        storeId: MOCK_STORES[0].id,
        source: 'ONLINE',
        status: 'CONFIRMED',
        totalPaise: 129900,
        idempotencyKey: 'sample-key-1',
        createdAt: new Date().toISOString(),
        items: [
          {
            productId: MOCK_PRODUCTS[0].id,
            storeId: MOCK_STORES[0].id,
            quantity: 1,
            unitPricePaise: 129900,
            subtotalPaise: 129900,
          }
        ],
      };
      ordersState.set(orderId, order);
    }

    const customer = MOCK_CUSTOMERS.find(c => c.id === order.customerId) || {
      id: order.customerId,
      name: 'Asha Rao',
      email: 'c01@demo.smartmart.in',
    };
    const store = MOCK_STORES.find(s => s.id === order.storeId) || {
      storeCode: 'BLR-01',
      city: 'Bengaluru',
    };

    return {
      ...order,
      customer,
      store,
    };
  }

  // --- GET /orders/:id/notifications ---
  if (pathname.includes('/orders/') && pathname.endsWith('/notifications') && method === 'GET') {
    const orderId = pathname.split('/')[2];
    const order = ordersState.get(orderId);
    const orderNum = order ? order.orderNumber : 'SM-001001';
    const total = order ? order.totalPaise : 129900;
    const itemsCount = order ? order.items.length : 1;

    return [
      {
        id: `notif-${orderId}`,
        orderId,
        channel: 'SIMULATED_EMAIL',
        message: `Order ${orderNum} confirmed: ${itemsCount} item(s), ₹${(total / 100).toFixed(2)}. Thank you for shopping with SmartMart!`,
        createdAt: order ? order.createdAt : new Date().toISOString(),
      }
    ];
  }

  // --- POST /pos/sale ---
  if (pathname === '/pos/sale' && method === 'POST') {
    const { storeId, items } = body || {};
    if (!storeId || !items || items.length === 0) {
      throw new ApiError('CART_EMPTY', 'No items provided for POS sale', {}, 400);
    }

    // Stock check
    for (const item of items) {
      const avail = getStock(storeId, item.productId);
      if (avail < item.quantity) {
        throw new ApiError('INSUFFICIENT_STOCK', `Only ${avail} left — you asked for ${item.quantity}`, {
          productId: item.productId,
          storeId,
          available: avail,
          requested: item.quantity,
        }, 409);
      }
    }

    // Deduct stock
    for (const item of items) {
      const avail = getStock(storeId, item.productId);
      setStock(storeId, item.productId, avail - item.quantity);
    }

    const orderId = `pos-${Date.now()}`;
    const orderNumber = `SM-POS-${String(2000 + ordersState.size + 1).padStart(6, '0')}`;
    const orderItems = items.map(i => {
      const prod = MOCK_PRODUCTS.find(p => p.id === i.productId);
      const unitPricePaise = prod ? prod.pricePaise : 10000;
      return {
        productId: i.productId,
        storeId,
        quantity: i.quantity,
        unitPricePaise,
        subtotalPaise: unitPricePaise * i.quantity,
      };
    });

    const totalPaise = orderItems.reduce((acc, cur) => acc + cur.subtotalPaise, 0);

    const posOrder = {
      id: orderId,
      orderNumber,
      customerId: null,
      storeId,
      source: 'POS_STORE',
      status: 'CONFIRMED',
      totalPaise,
      idempotencyKey: `pos-key-${Date.now()}`,
      createdAt: new Date().toISOString(),
      items: orderItems,
    };

    ordersState.set(orderId, posOrder);
    return { order: posOrder };
  }

  // --- GET /xray/metrics ---
  if (pathname === '/xray/metrics' && method === 'GET') {
    return mockXRayBundle();
  }

  // --- POST /demo/race ---
  if (pathname === '/demo/race' && method === 'POST') {
    const { productId, storeId, buyers = 50, mode = 'safe' } = body || {};
    const baselineQty = getStock(storeId, productId);

    const results = [];
    let currentStock = baselineQty;

    if (mode === 'safe') {
      for (let i = 0; i < buyers; i++) {
        const cust = MOCK_CUSTOMERS[i] || MOCK_CUSTOMERS[0];
        if (currentStock >= 1) {
          currentStock -= 1;
          setStock(storeId, productId, currentStock);
          results.push({
            customerId: cust.id,
            status: 'SUCCESS',
            orderId: `race-ord-${i + 1}`,
          });
        } else {
          results.push({
            customerId: cust.id,
            status: 'INSUFFICIENT_STOCK',
          });
        }
      }
      const successCount = results.filter(r => r.status === 'SUCCESS').length;
      return {
        results,
        summary: {
          success: successCount,
          failed: buyers - successCount,
          baselineQty,
          finalStock: currentStock,
        },
      };
    } else {
      // Naive mode: simulated oversell
      const oversoldStock = baselineQty - buyers;
      setStock(storeId, productId, 0);
      for (let i = 0; i < buyers; i++) {
        const cust = MOCK_CUSTOMERS[i] || MOCK_CUSTOMERS[0];
        results.push({
          customerId: cust.id,
          status: 'SUCCESS',
          orderId: `naive-ord-${i + 1}`,
        });
      }
      return {
        results,
        summary: {
          success: buyers,
          failed: 0,
          baselineQty,
          finalStock: oversoldStock,
        },
      };
    }
  }

  // --- POST /demo/reset ---
  if (pathname === '/demo/reset' && method === 'POST') {
    initInventory();
    ordersState.clear();
    idempotencyKeyMap.clear();
    cartsState.clear();
    Object.keys(chaosState).forEach(k => { chaosState[k] = false; });
    return { durationMs: 42 };
  }

  // --- ADMIN CHAOS ENDPOINTS ---
  if (pathname === '/admin/chaos' && method === 'POST') {
    const { target, enabled } = body || {};
    if (target && chaosState[target] !== undefined) {
      chaosState[target] = Boolean(enabled);
    }
    return { target, paused: Boolean(enabled) };
  }

  if (pathname === '/admin/chaos' && method === 'GET') {
    return { ...chaosState };
  }

  if (pathname === '/admin/outbox/requeue' && method === 'POST') {
    return { requeued: 4 };
  }

  if (pathname === '/admin/reindex' && method === 'POST') {
    return { indexed: MOCK_PRODUCTS.length };
  }

  throw new ApiError('ENDPOINT_NOT_FOUND', `Mock endpoint ${method} ${pathname} not found`, {}, 404);
}
