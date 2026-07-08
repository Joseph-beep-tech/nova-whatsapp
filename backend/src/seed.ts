/**
 * seed.ts — Run once to populate the database with realistic data.
 * Usage: npx ts-node src/seed.ts
 */
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { prisma } from './lib/prisma';

dotenv.config();

const RESTAURANTS = [
  {
    name: 'Java House Westlands',
    description: "Kenya's premier coffee house serving breakfast, lunch, dinner and specialty coffee.",
    cuisine: 'Kenyan',
    rating: 4.6, reviewCount: 1240,
    deliveryFee: 150, deliveryTimeMinutesMin: 20, deliveryTimeMinutesMax: 40,
    address: 'Ring Road Westlands, Nairobi',
    locationLat: -1.2675, locationLng: 36.8082,
    phone: '+254 20 444 0000',
    hours: 'Mon–Sun 07:00–22:00',
    minOrder: 500,
    features: ['Dine-in', 'Takeaway', 'Delivery', 'Free WiFi'],
    isOpen: true, isPromoted: true,
    imageUrl: 'https://images.unsplash.com/photo-1600093463592-8e36ae95ef56?w=600',
  },
  {
    name: 'Chicken Inn Karen',
    description: "Flame-grilled chicken, burgers, and sides. Kenya's favourite fast food.",
    cuisine: 'Fast Food',
    rating: 4.2, reviewCount: 890,
    deliveryFee: 100, deliveryTimeMinutesMin: 15, deliveryTimeMinutesMax: 30,
    address: 'Karen Shopping Centre, Nairobi',
    locationLat: -1.3227, locationLng: 36.7123,
    phone: '+254 20 388 0000',
    hours: 'Mon–Sun 09:00–22:00',
    minOrder: 300,
    features: ['Dine-in', 'Drive-through', 'Takeaway', 'Delivery'],
    isOpen: true, isPromoted: false,
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600',
  },
  {
    name: 'Artcaffe Garden City',
    description: 'European-inspired café serving artisan coffee, pastries and full meals all day.',
    cuisine: 'European',
    rating: 4.5, reviewCount: 670,
    deliveryFee: 200, deliveryTimeMinutesMin: 25, deliveryTimeMinutesMax: 50,
    address: 'Garden City Mall, Thika Road, Nairobi',
    locationLat: -1.2314, locationLng: 36.8695,
    phone: '+254 20 555 1234',
    hours: 'Mon–Sun 07:30–21:30',
    minOrder: 600,
    features: ['Dine-in', 'Delivery', 'Outdoor Seating', 'Vegan Options'],
    isOpen: true, isPromoted: true,
    imageUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=600',
  },
  {
    name: 'Mama Oliech Fish Restaurant',
    description: 'Iconic Nairobi eatery famous for tilapia, omena and traditional Kenyan sides.',
    cuisine: 'Kenyan',
    rating: 4.8, reviewCount: 2100,
    deliveryFee: 120, deliveryTimeMinutesMin: 25, deliveryTimeMinutesMax: 45,
    address: 'Huruma Road, Hurlingham, Nairobi',
    locationLat: -1.2958, locationLng: 36.7872,
    phone: '+254 722 345 678',
    hours: 'Mon–Sat 11:00–21:00',
    minOrder: 400,
    features: ['Dine-in', 'Takeaway', 'Delivery'],
    isOpen: true, isPromoted: false,
    imageUrl: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600',
  },
  {
    name: 'Bollywood Bites',
    description: 'Authentic North and South Indian cuisine with tandoor specialties and biryanis.',
    cuisine: 'Indian',
    rating: 4.4, reviewCount: 520,
    deliveryFee: 180, deliveryTimeMinutesMin: 30, deliveryTimeMinutesMax: 55,
    address: 'Parklands, Nairobi',
    locationLat: -1.2612, locationLng: 36.8167,
    phone: '+254 733 456 789',
    hours: 'Mon–Sun 12:00–22:30',
    minOrder: 700,
    features: ['Dine-in', 'Delivery', 'Halal', 'Vegetarian Menu'],
    isOpen: false, isPromoted: false,
    imageUrl: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600',
  },
  {
    name: "Galito's Nairobi CBD",
    description: 'Peri-peri flame-grilled chicken and wraps, Mozambican-Portuguese style.',
    cuisine: 'Fast Food',
    rating: 4.3, reviewCount: 760,
    deliveryFee: 130, deliveryTimeMinutesMin: 20, deliveryTimeMinutesMax: 35,
    address: 'Kimathi Street, Nairobi CBD',
    locationLat: -1.2832, locationLng: 36.8183,
    phone: '+254 20 222 3333',
    hours: 'Mon–Sun 10:00–22:00',
    minOrder: 350,
    features: ['Dine-in', 'Takeaway', 'Delivery'],
    isOpen: true, isPromoted: false,
    imageUrl: 'https://images.unsplash.com/photo-1587558873445-dd91745b979b?w=600',
  },
];

type MenuItemSeed = {
  name: string; category: string; price: number; description?: string;
  prepTimeMinutes?: number; isVegetarian?: boolean; isFeatured?: boolean;
};

const MENU_ITEMS_MAP: Record<string, MenuItemSeed[]> = {
  'Java House Westlands': [
    { name: 'Full English Breakfast', category: 'Breakfast', price: 950, description: 'Eggs, bacon, sausages, grilled tomato, mushrooms, toast', prepTimeMinutes: 15, isVegetarian: false, isFeatured: true },
    { name: 'Smashed Avocado Toast', category: 'Breakfast', price: 750, description: 'Sourdough, avocado, poached eggs, chilli flakes', prepTimeMinutes: 10, isVegetarian: true, isFeatured: true },
    { name: 'Americano Coffee', category: 'Beverages', price: 280, description: 'Double shot espresso with hot water', prepTimeMinutes: 5, isVegetarian: true },
    { name: 'Flat White', category: 'Beverages', price: 320, description: 'Ristretto shots, silky steamed milk', prepTimeMinutes: 5, isVegetarian: true, isFeatured: true },
    { name: 'Club Sandwich', category: 'Mains', price: 1100, description: 'Triple-decker, chicken, bacon, lettuce, tomato, fries', prepTimeMinutes: 20, isVegetarian: false },
    { name: 'Pasta Arrabiata', category: 'Mains', price: 890, description: 'Penne, spicy tomato sauce, garlic, basil', prepTimeMinutes: 20, isVegetarian: true },
    { name: 'Mango Smoothie', category: 'Beverages', price: 380, description: 'Fresh mango, yoghurt, honey', prepTimeMinutes: 5, isVegetarian: true },
    { name: 'Chocolate Lava Cake', category: 'Desserts', price: 650, description: 'Warm chocolate fondant, vanilla ice cream', prepTimeMinutes: 12, isVegetarian: true },
  ],
  'Chicken Inn Karen': [
    { name: 'Quarter Chicken Meal', category: 'Chicken', price: 650, description: 'Flame-grilled quarter chicken, chips, coleslaw', prepTimeMinutes: 12, isVegetarian: false, isFeatured: true },
    { name: 'Half Chicken Meal', category: 'Chicken', price: 950, description: 'Flame-grilled half chicken, chips, coleslaw, roll', prepTimeMinutes: 15, isVegetarian: false, isFeatured: true },
    { name: 'Chicken Burger', category: 'Burgers', price: 580, description: 'Crispy chicken fillet, lettuce, tomato, mayo', prepTimeMinutes: 10, isVegetarian: false },
    { name: 'Beef Burger', category: 'Burgers', price: 620, description: '100g beef patty, cheese, pickles, onion', prepTimeMinutes: 10, isVegetarian: false, isFeatured: true },
    { name: 'Chips', category: 'Sides', price: 200, description: 'Crispy golden chips', prepTimeMinutes: 8, isVegetarian: true },
    { name: 'Coleslaw', category: 'Sides', price: 120, description: 'Creamy coleslaw', prepTimeMinutes: 2, isVegetarian: true },
    { name: 'Pepsi 500ml', category: 'Drinks', price: 100, prepTimeMinutes: 1, isVegetarian: true },
    { name: 'Chicken Wrap', category: 'Chicken', price: 520, description: 'Grilled chicken strips, lettuce, garlic sauce, tortilla', prepTimeMinutes: 8, isVegetarian: false },
  ],
  'Artcaffe Garden City': [
    { name: 'Eggs Benedict', category: 'Breakfast', price: 1100, description: 'Poached eggs, hollandaise, Canadian bacon, English muffin', prepTimeMinutes: 15, isVegetarian: false, isFeatured: true },
    { name: 'Granola Bowl', category: 'Breakfast', price: 750, description: 'House granola, Greek yoghurt, seasonal fruit, honey', prepTimeMinutes: 5, isVegetarian: true },
    { name: 'Artcaffe Burger', category: 'Mains', price: 1350, description: 'Wagyu beef, truffle mayo, aged cheddar, brioche bun', prepTimeMinutes: 18, isVegetarian: false, isFeatured: true },
    { name: 'Grilled Salmon', category: 'Mains', price: 1800, description: 'Atlantic salmon, lemon butter, asparagus, baby potatoes', prepTimeMinutes: 25, isVegetarian: false },
    { name: 'Margherita Pizza', category: 'Pizza', price: 1100, description: 'San Marzano tomato, mozzarella, fresh basil', prepTimeMinutes: 20, isVegetarian: true, isFeatured: true },
    { name: 'Cappuccino', category: 'Coffee', price: 380, description: 'Double espresso, steamed milk, milk foam', prepTimeMinutes: 5, isVegetarian: true },
    { name: 'Cheesecake', category: 'Desserts', price: 750, description: 'New York style, strawberry compote', prepTimeMinutes: 3, isVegetarian: true },
    { name: 'Caesar Salad', category: 'Salads', price: 900, description: 'Cos lettuce, parmesan, croutons, caesar dressing, chicken', prepTimeMinutes: 10, isVegetarian: false },
  ],
  'Mama Oliech Fish Restaurant': [
    { name: 'Whole Tilapia', category: 'Fish', price: 900, description: 'Fresh tilapia, deep fried, ugali, sukuma wiki, kachumbari', prepTimeMinutes: 20, isVegetarian: false, isFeatured: true },
    { name: 'Omena (Dagaa)', category: 'Fish', price: 350, description: 'Smoked omena, tomato sauce, ugali', prepTimeMinutes: 15, isVegetarian: false },
    { name: 'Ugali & Githeri', category: 'Vegetarian', price: 280, description: 'Maize ugali, mixed beans and corn', prepTimeMinutes: 10, isVegetarian: true },
    { name: 'Beef Stew', category: 'Meat', price: 550, description: 'Slow-cooked beef, vegetables, ugali', prepTimeMinutes: 15, isVegetarian: false, isFeatured: true },
    { name: 'Goat Ribs', category: 'Meat', price: 750, description: 'Grilled goat ribs, kachumbari, ugali', prepTimeMinutes: 25, isVegetarian: false },
    { name: 'Sukuma Wiki', category: 'Sides', price: 100, description: 'Sautéed collard greens, tomato, onion', prepTimeMinutes: 5, isVegetarian: true },
    { name: 'Chai ya Tangawizi', category: 'Drinks', price: 80, description: 'Ginger spiced tea, full cream milk', prepTimeMinutes: 5, isVegetarian: true },
    { name: 'Fresh Juice', category: 'Drinks', price: 150, description: 'Seasonal fruit juice, no sugar added', prepTimeMinutes: 5, isVegetarian: true },
  ],
  'Bollywood Bites': [
    { name: 'Chicken Biryani', category: 'Rice', price: 950, description: 'Basmati rice, whole spices, marinated chicken, raita', prepTimeMinutes: 25, isVegetarian: false, isFeatured: true },
    { name: 'Butter Chicken', category: 'Curries', price: 1100, description: 'Tender chicken, creamy tomato-butter sauce, naan', prepTimeMinutes: 20, isVegetarian: false, isFeatured: true },
    { name: 'Dal Makhani', category: 'Vegetarian', price: 750, description: 'Black lentils, kidney beans, cream, butter, naan', prepTimeMinutes: 20, isVegetarian: true },
    { name: 'Palak Paneer', category: 'Vegetarian', price: 850, description: 'Cottage cheese, spinach sauce, naan', prepTimeMinutes: 18, isVegetarian: true, isFeatured: true },
    { name: 'Garlic Naan', category: 'Breads', price: 180, description: 'Tandoor-baked, garlic butter', prepTimeMinutes: 8, isVegetarian: true },
    { name: 'Chicken Tikka', category: 'Starters', price: 900, description: 'Tandoor chicken, mint chutney, onion salad', prepTimeMinutes: 20, isVegetarian: false },
    { name: 'Mango Lassi', category: 'Drinks', price: 300, description: 'Yoghurt, fresh mango, cardamom', prepTimeMinutes: 5, isVegetarian: true },
    { name: 'Gulab Jamun', category: 'Desserts', price: 350, description: 'Milk dumplings in rose syrup, ice cream', prepTimeMinutes: 5, isVegetarian: true },
  ],
  "Galito's Nairobi CBD": [
    { name: 'Whole Chicken', category: 'Chicken', price: 1600, description: 'Peri-peri marinated whole chicken, 3 sides', prepTimeMinutes: 20, isVegetarian: false, isFeatured: true },
    { name: 'Half Chicken Meal', category: 'Chicken', price: 950, description: 'Half peri-peri chicken, 2 sides', prepTimeMinutes: 15, isVegetarian: false, isFeatured: true },
    { name: 'Chicken Wrap', category: 'Wraps', price: 620, description: 'Grilled chicken, peri-peri sauce, lettuce, tortilla', prepTimeMinutes: 10, isVegetarian: false },
    { name: 'Beef Wrap', category: 'Wraps', price: 650, description: 'Sliced beef, peppers, mushrooms, cheese', prepTimeMinutes: 10, isVegetarian: false },
    { name: 'Corn on the Cob', category: 'Sides', price: 200, description: 'Grilled corn, herb butter', prepTimeMinutes: 8, isVegetarian: true },
    { name: 'Spicy Rice', category: 'Sides', price: 180, description: 'Peri-peri seasoned rice', prepTimeMinutes: 5, isVegetarian: true },
    { name: 'Coleslaw', category: 'Sides', price: 150, description: 'Creamy coleslaw', prepTimeMinutes: 2, isVegetarian: true },
    { name: 'Lemonade', category: 'Drinks', price: 180, description: 'Fresh lemonade, mint', prepTimeMinutes: 3, isVegetarian: true },
  ],
};

const RIDERS = [
  { name: 'Brian Kamau', email: 'brian.kamau@novago.com', phone: '+254 700 111 001', vehicleType: 'motorcycle', status: 'available' },
  { name: 'Grace Wanjiru', email: 'grace.wanjiru@novago.com', phone: '+254 700 111 002', vehicleType: 'motorcycle', status: 'available' },
  { name: 'Dennis Otieno', email: 'dennis.otieno@novago.com', phone: '+254 700 111 003', vehicleType: 'bicycle', status: 'busy' },
  { name: 'Faith Muthoni', email: 'faith.muthoni@novago.com', phone: '+254 700 111 004', vehicleType: 'motorcycle', status: 'offline' },
  { name: 'Kevin Ochieng', email: 'kevin.ochieng@novago.com', phone: '+254 700 111 005', vehicleType: 'motorcycle', status: 'available' },
];

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function seed() {
  console.log('🌱 Connecting to PostgreSQL...');
  await prisma.$connect();
  console.log('✅ Connected');

  // Clear existing data
  await prisma.$transaction([
    prisma.orderPayment.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.order.deleteMany(),
    prisma.menuItem.deleteMany(),
    prisma.rider.deleteMany(),
    prisma.restaurant.deleteMany(),
    prisma.user.deleteMany(),
  ]);
  console.log('🗑  Cleared existing data');

  // Users
  const [adminUser, restUser] = await Promise.all([
    prisma.user.create({
      data: {
        email: 'admin@novago.com',
        password: await bcrypt.hash('admin123', 10),
        firstName: 'Joseph',
        lastName: 'Okoth',
        organization: 'NovaGo Technologies',
        role: 'admin',
      },
    }),
    prisma.user.create({
      data: {
        email: 'restaurant@novago.com',
        password: await bcrypt.hash('restaurant123', 10),
        firstName: 'Restaurant',
        lastName: 'Manager',
        organization: 'NovaGo Restaurant Partner',
        role: 'user',
      },
    }),
  ]);
  console.log('👤 Created users');

  // Restaurants
  const restaurantDocs = await Promise.all(
    RESTAURANTS.map((r) =>
      prisma.restaurant.create({ data: { ...r, ownerId: restUser.id } })
    )
  );
  console.log(`🍽  Created ${restaurantDocs.length} restaurants`);

  // Menu Items
  let menuCount = 0;
  for (const rDoc of restaurantDocs) {
    const items = MENU_ITEMS_MAP[rDoc.name] || [];
    await Promise.all(
      items.map((item, idx) =>
        prisma.menuItem.create({
          data: { ...item, restaurantId: rDoc.id, sortOrder: idx },
        })
      )
    );
    menuCount += items.length;
  }
  console.log(`🥗  Created ${menuCount} menu items`);

  // Riders
  const riderDocs = await Promise.all(RIDERS.map((r) => prisma.rider.create({ data: r })));
  console.log(`🏍  Created ${riderDocs.length} riders`);

  // Fetch menu items for order generation
  const allMenuItems = await prisma.menuItem.findMany();

  const ORDER_STATUSES = ['delivered', 'delivered', 'delivered', 'delivered', 'preparing', 'on_the_way', 'pending', 'cancelled'] as const;
  const CUSTOMERS = [
    { name: 'Alice Njeri', phone: '+254 712 000 001', address: 'Lavington, Nairobi' },
    { name: 'Tom Mwangi', phone: '+254 722 000 002', address: 'Kilimani, Nairobi' },
    { name: 'Sarah Akinyi', phone: '+254 733 000 003', address: 'Upperhill, Nairobi' },
    { name: 'James Kariuki', phone: '+254 711 000 004', address: 'South B, Nairobi' },
    { name: 'Mary Wambua', phone: '+254 723 000 005', address: 'Westlands, Nairobi' },
    { name: 'Paul Odhiambo', phone: '+254 745 000 006', address: 'Kasarani, Nairobi' },
    { name: 'Linda Chebet', phone: '+254 756 000 007', address: 'Runda, Nairobi' },
    { name: 'Eric Mutua', phone: '+254 767 000 008', address: 'Ngong Road, Nairobi' },
  ];

  let orderCount = 0;
  for (let i = 0; i < 60; i++) {
    const rDoc = restaurantDocs[i % restaurantDocs.length];
    const rMenu = allMenuItems.filter((m) => m.restaurantId === rDoc.id);
    if (rMenu.length === 0) continue;

    const customer = CUSTOMERS[i % CUSTOMERS.length];
    const status = ORDER_STATUSES[i % ORDER_STATUSES.length];
    const itemCount = randomBetween(1, 3);
    const orderItems = [];
    let subtotal = 0;

    for (let j = 0; j < itemCount; j++) {
      const menuItem = rMenu[randomBetween(0, rMenu.length - 1)];
      const qty = randomBetween(1, 2);
      orderItems.push({ menuItemId: menuItem.id, name: menuItem.name, quantity: qty, price: menuItem.price });
      subtotal += menuItem.price * qty;
    }

    const deliveryFee = rDoc.deliveryFee;
    const tax = Math.round(subtotal * 0.16);
    const total = subtotal + deliveryFee + tax;
    const daysBack = randomBetween(0, 30);
    const createdAt = daysAgo(daysBack);

    const assignedRider = (status === 'on_the_way' || status === 'delivered')
      ? riderDocs[i % riderDocs.length].id
      : undefined;

    const statusFlow = ['pending', 'confirmed', 'preparing', 'ready', 'assigned', 'picked_up', 'on_the_way', 'delivered'];
    const flowIdx = statusFlow.indexOf(status);
    const statusHistory = statusFlow
      .slice(0, Math.max(0, flowIdx + 1))
      .map((s, idx) => ({
        status: s,
        message: { pending: 'Order placed.', confirmed: 'Confirmed by restaurant.', preparing: 'Being prepared.', ready: 'Ready for pickup.', assigned: 'Rider assigned.', picked_up: 'Rider picked up.', on_the_way: 'On the way!', delivered: 'Delivered.' }[s] || s,
        timestamp: new Date(createdAt.getTime() + idx * 5 * 60000).toISOString(),
      }));

    const order = await prisma.order.create({
      data: {
        restaurantId: rDoc.id,
        restaurantLocAddr: rDoc.address,
        restaurantLocLat: rDoc.locationLat,
        restaurantLocLng: rDoc.locationLng,
        items: orderItems as unknown as import('@prisma/client').Prisma.InputJsonValue,
        subtotal, deliveryFee, tax, total,
        status,
        customerName: customer.name,
        customerPhone: customer.phone,
        deliveryAddress: customer.address,
        driverId: assignedRider,
        paymentMethod: 'mpesa',
        paymentStatus: status === 'delivered' ? 'paid' : 'pending',
        source: (['web', 'whatsapp', 'voice'] as const)[i % 3],
        statusHistory: statusHistory as unknown as import('@prisma/client').Prisma.InputJsonValue,
        createdAt,
        updatedAt: createdAt,
      },
    });

    if (status === 'delivered') {
      await prisma.orderPayment.create({
        data: {
          orderId: order.id,
          amount: total,
          method: 'mpesa',
          status: 'completed',
          reference: `QKR${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
        },
      });
    }

    orderCount++;
  }

  console.log(`📦  Created ${orderCount} orders`);
  console.log('\n✅ Database seeded successfully!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Login credentials:');
  console.log('  Admin:      admin@novago.com      / admin123');
  console.log('  Restaurant: restaurant@novago.com  / restaurant123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
