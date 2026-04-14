import { useState, useCallback, useEffect } from "react";
import { Settings, User, Bell, Shield, Palette, Globe, Moon, Volume2, HelpCircle, LogOut, ChevronRight, Smartphone, Watch, Activity, Bluetooth, Check, ArrowLeft, Loader2, X, Signal, FileText, LayoutGrid, Lock } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";

interface PairedDevice {
  id: string;
  name: string;
  type: string;
  icon: string;
  connected: boolean;
  battery?: number;
  lastSeen?: string;
  gattServer?: any;
}

const WEARABLE_SERVICES: Record<string, { name: string; icon: string; services: string[] }> = {
  heart_rate: { name: "Heart Rate Monitor", icon: "❤️", services: ["heart_rate"] },
  fitness: { name: "Fitness Tracker", icon: "🏃", services: ["running_speed_and_cadence", "cycling_speed_and_cadence"] },
  watch: { name: "Smartwatch", icon: "⌚", services: ["device_information", "battery_service"] },
  health: { name: "Health Device", icon: "🩺", services: ["health_thermometer", "blood_pressure"] },
};

const KNOWN_WEARABLES = [
  { name: "Apple Watch", icon: "⌚", type: "watch" },
  { name: "Fitbit", icon: "📟", type: "fitness" },
  { name: "Samsung Galaxy Watch", icon: "⌚", type: "watch" },
  { name: "Garmin", icon: "🏃", type: "fitness" },
  { name: "Google Pixel Watch", icon: "⌚", type: "watch" },
  { name: "Whoop", icon: "💪", type: "fitness" },
  { name: "Oura Ring", icon: "💍", type: "health" },
  { name: "Amazfit", icon: "⌚", type: "watch" },
];

interface ThemeScheme {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
  light?: boolean;
}

const THEME_COLORS: ThemeScheme[] = [
  // Dark 3-color schemes (180)
  { name: "Gold & Crimson", primary: "45 100% 50%", secondary: "348 83% 47%", accent: "25 95% 53%", bg: "0 0% 3%" },
  { name: "Royal Amethyst", primary: "220 90% 56%", secondary: "270 76% 53%", accent: "300 75% 50%", bg: "240 15% 4%" },
  { name: "Emerald Flame", primary: "160 84% 39%", secondary: "0 72% 51%", accent: "38 92% 50%", bg: "160 10% 4%" },
  { name: "Neon Cyber", primary: "180 100% 50%", secondary: "300 100% 50%", accent: "60 100% 50%", bg: "220 20% 3%" },
  { name: "Sunset Blaze", primary: "25 95% 53%", secondary: "350 65% 55%", accent: "45 100% 50%", bg: "15 10% 4%" },
  { name: "Arctic Aurora", primary: "190 85% 50%", secondary: "140 60% 50%", accent: "270 76% 53%", bg: "200 15% 4%" },
  { name: "Midnight Rose", primary: "330 80% 55%", secondary: "270 50% 60%", accent: "200 85% 55%", bg: "280 12% 3%" },
  { name: "Forest Fire", primary: "140 50% 35%", secondary: "0 72% 51%", accent: "38 92% 50%", bg: "120 15% 3%" },
  { name: "Ocean Coral", primary: "195 80% 45%", secondary: "16 100% 66%", accent: "174 72% 44%", bg: "195 15% 3%" },
  { name: "Violet Storm", primary: "280 68% 55%", secondary: "210 100% 60%", accent: "330 80% 55%", bg: "270 15% 3%" },
  { name: "Solar Eclipse", primary: "38 92% 50%", secondary: "0 0% 85%", accent: "210 100% 60%", bg: "0 0% 2%" },
  { name: "Cherry Blossom", primary: "340 60% 55%", secondary: "310 50% 65%", accent: "0 0% 95%", bg: "330 10% 4%" },
  { name: "Tropical Heat", primary: "30 100% 55%", secondary: "160 84% 39%", accent: "60 80% 50%", bg: "20 10% 3%" },
  { name: "Galaxy Drift", primary: "260 50% 65%", secondary: "200 85% 55%", accent: "330 80% 55%", bg: "250 20% 3%" },
  { name: "Copper Jade", primary: "20 70% 50%", secondary: "155 55% 40%", accent: "38 92% 50%", bg: "25 10% 3%" },
  { name: "Ice Crystal", primary: "200 85% 55%", secondary: "180 70% 45%", accent: "220 90% 56%", bg: "210 15% 4%" },
  { name: "Lava Flow", primary: "0 72% 51%", secondary: "25 95% 53%", accent: "45 100% 50%", bg: "0 15% 3%" },
  { name: "Deep Space", primary: "230 55% 45%", secondary: "270 76% 53%", accent: "190 85% 50%", bg: "240 20% 2%" },
  { name: "Mango Tango", primary: "30 100% 55%", secondary: "350 65% 55%", accent: "60 80% 50%", bg: "25 10% 3%" },
  { name: "Nordic Frost", primary: "210 14% 53%", secondary: "195 80% 45%", accent: "180 70% 45%", bg: "210 10% 4%" },
  { name: "Dragon Scale", primary: "0 72% 51%", secondary: "45 100% 50%", accent: "160 84% 39%", bg: "0 10% 3%" },
  { name: "Moonlit Purple", primary: "270 76% 53%", secondary: "220 90% 56%", accent: "0 0% 85%", bg: "260 15% 3%" },
  { name: "Tiger Eye", primary: "33 55% 45%", secondary: "45 100% 50%", accent: "0 72% 51%", bg: "30 10% 3%" },
  { name: "Plasma Core", primary: "300 75% 50%", secondary: "180 100% 50%", accent: "60 100% 50%", bg: "290 15% 3%" },
  { name: "Sahara Dusk", primary: "38 92% 50%", secondary: "20 70% 50%", accent: "345 55% 35%", bg: "30 10% 3%" },
  { name: "Prism", primary: "0 72% 51%", secondary: "120 60% 45%", accent: "220 90% 56%", bg: "0 0% 3%" },
  { name: "Nebula", primary: "270 76% 53%", secondary: "330 80% 55%", accent: "190 85% 50%", bg: "280 15% 3%" },
  { name: "Firefly", primary: "60 80% 50%", secondary: "160 84% 39%", accent: "30 100% 55%", bg: "70 10% 3%" },
  { name: "Rust & Steel", primary: "20 70% 50%", secondary: "210 14% 53%", accent: "38 92% 50%", bg: "15 10% 3%" },
  { name: "Candy Rush", primary: "330 80% 55%", secondary: "190 85% 50%", accent: "60 80% 50%", bg: "320 10% 3%" },
  { name: "Volcanic", primary: "0 72% 51%", secondary: "33 55% 45%", accent: "45 100% 50%", bg: "5 15% 3%" },
  { name: "Aqua Spark", primary: "174 72% 44%", secondary: "60 80% 50%", accent: "220 90% 56%", bg: "180 10% 3%" },
  { name: "Velvet Night", primary: "290 47% 43%", secondary: "330 80% 55%", accent: "38 92% 50%", bg: "285 15% 3%" },
  { name: "Spring Bud", primary: "90 76% 45%", secondary: "160 84% 39%", accent: "45 100% 50%", bg: "100 10% 3%" },
  { name: "Cosmic Dust", primary: "240 80% 62%", secondary: "300 75% 50%", accent: "180 100% 50%", bg: "250 15% 3%" },
  { name: "Marigold Dusk", primary: "43 96% 56%", secondary: "20 80% 65%", accent: "0 72% 51%", bg: "40 10% 3%" },
  { name: "Tundra", primary: "200 85% 55%", secondary: "210 14% 53%", accent: "160 50% 55%", bg: "205 12% 4%" },
  { name: "Inferno", primary: "0 72% 51%", secondary: "25 95% 53%", accent: "60 100% 50%", bg: "5 12% 3%" },
  { name: "Jade Harbor", primary: "155 55% 40%", secondary: "195 80% 45%", accent: "38 92% 50%", bg: "160 10% 3%" },
  { name: "Bubblegum", primary: "330 80% 55%", secondary: "260 50% 65%", accent: "190 85% 50%", bg: "320 8% 4%" },
  { name: "Storm Cloud", primary: "215 16% 47%", secondary: "220 90% 56%", accent: "270 76% 53%", bg: "220 12% 4%" },
  { name: "Wine & Gold", primary: "345 55% 35%", secondary: "45 100% 50%", accent: "20 70% 50%", bg: "340 10% 3%" },
  { name: "Neon Miami", primary: "300 100% 50%", secondary: "180 100% 50%", accent: "330 80% 55%", bg: "280 15% 3%" },
  { name: "Bamboo", primary: "80 40% 40%", secondary: "38 92% 50%", accent: "160 84% 39%", bg: "75 10% 3%" },
  { name: "Berry Crush", primary: "350 65% 55%", secondary: "270 76% 53%", accent: "30 100% 55%", bg: "345 10% 3%" },
  { name: "Steel Ember", primary: "210 14% 53%", secondary: "0 72% 51%", accent: "38 92% 50%", bg: "200 10% 4%" },
  { name: "Lagoon", primary: "174 72% 44%", secondary: "155 55% 40%", accent: "200 85% 55%", bg: "170 12% 3%" },
  { name: "Phoenix", primary: "25 95% 53%", secondary: "0 72% 51%", accent: "45 100% 50%", bg: "20 10% 3%" },
  { name: "Mystic Teal", primary: "180 70% 45%", secondary: "270 76% 53%", accent: "45 100% 50%", bg: "175 12% 3%" },
  { name: "Sunflower", primary: "45 100% 50%", secondary: "90 76% 45%", accent: "25 95% 53%", bg: "50 10% 3%" },
  { name: "Night Orchid", primary: "290 47% 43%", secondary: "210 100% 60%", accent: "0 0% 85%", bg: "285 12% 3%" },
  { name: "Caramel", primary: "33 55% 45%", secondary: "20 80% 65%", accent: "0 72% 51%", bg: "30 8% 3%" },
  { name: "Blizzard", primary: "200 85% 55%", secondary: "0 0% 85%", accent: "220 90% 56%", bg: "210 10% 4%" },
  { name: "Pomegranate", primary: "348 83% 47%", secondary: "330 80% 55%", accent: "45 100% 50%", bg: "345 12% 3%" },
  { name: "Pine Forest", primary: "140 50% 35%", secondary: "80 40% 40%", accent: "38 92% 50%", bg: "130 15% 3%" },
  { name: "Electric Lime", primary: "80 80% 50%", secondary: "160 84% 39%", accent: "190 85% 50%", bg: "85 10% 3%" },
  { name: "Obsidian", primary: "0 0% 75%", secondary: "0 0% 55%", accent: "45 100% 50%", bg: "0 0% 2%" },
  { name: "Honey Bee", primary: "45 100% 50%", secondary: "33 55% 45%", accent: "0 0% 10%", bg: "42 10% 3%" },
  { name: "Twilight", primary: "260 50% 65%", secondary: "330 80% 55%", accent: "200 85% 55%", bg: "255 12% 3%" },
  { name: "Salsa", primary: "0 72% 51%", secondary: "45 100% 50%", accent: "90 76% 45%", bg: "355 10% 3%" },
  { name: "Polar Bear", primary: "195 80% 45%", secondary: "0 0% 85%", accent: "210 14% 53%", bg: "200 10% 4%" },
  { name: "Cinnamon", primary: "20 70% 50%", secondary: "45 100% 50%", accent: "0 0% 85%", bg: "18 10% 3%" },
  { name: "Aurora Green", primary: "160 84% 39%", secondary: "180 100% 50%", accent: "270 76% 53%", bg: "165 12% 3%" },
  { name: "Scarlet Silk", primary: "0 72% 51%", secondary: "330 80% 55%", accent: "45 100% 50%", bg: "355 12% 3%" },
  { name: "Mocha", primary: "20 30% 40%", secondary: "33 55% 45%", accent: "45 100% 50%", bg: "20 10% 3%" },
  { name: "Matrix", primary: "120 100% 50%", secondary: "0 0% 85%", accent: "160 84% 39%", bg: "0 0% 2%" },
  { name: "Peacock", primary: "180 70% 45%", secondary: "160 84% 39%", accent: "210 100% 60%", bg: "185 12% 3%" },
  { name: "Poppy", primary: "0 72% 51%", secondary: "25 95% 53%", accent: "160 84% 39%", bg: "0 10% 3%" },
  { name: "Glacier", primary: "200 85% 55%", secondary: "190 85% 50%", accent: "0 0% 95%", bg: "205 10% 4%" },
  { name: "Ember Glow", primary: "25 95% 53%", secondary: "45 100% 50%", accent: "0 72% 51%", bg: "20 10% 3%" },
  { name: "Cosmic Ray", primary: "270 76% 53%", secondary: "190 85% 50%", accent: "60 80% 50%", bg: "265 12% 3%" },
  { name: "Denim", primary: "220 90% 56%", secondary: "210 14% 53%", accent: "0 0% 85%", bg: "215 15% 4%" },
  { name: "Garnet", primary: "345 55% 35%", secondary: "0 72% 51%", accent: "38 92% 50%", bg: "340 12% 3%" },
  { name: "Pistachio", primary: "90 40% 50%", secondary: "155 55% 40%", accent: "45 100% 50%", bg: "95 10% 3%" },
  { name: "Thunder", primary: "240 80% 62%", secondary: "0 0% 85%", accent: "45 100% 50%", bg: "235 15% 3%" },
  { name: "Petal", primary: "340 60% 55%", secondary: "25 80% 65%", accent: "160 50% 55%", bg: "335 8% 4%" },
  { name: "Titanium", primary: "210 14% 53%", secondary: "0 0% 75%", accent: "220 90% 56%", bg: "215 10% 4%" },
  { name: "Wildfire", primary: "16 100% 66%", secondary: "0 72% 51%", accent: "45 100% 50%", bg: "10 10% 3%" },
  { name: "Wisteria", primary: "260 50% 65%", secondary: "290 47% 43%", accent: "0 0% 85%", bg: "265 10% 4%" },
  { name: "Saffron", primary: "45 100% 50%", secondary: "30 100% 55%", accent: "0 72% 51%", bg: "42 10% 3%" },
  { name: "Eclipse Blue", primary: "220 90% 56%", secondary: "260 50% 65%", accent: "0 0% 85%", bg: "230 15% 3%" },
  { name: "Palm Beach", primary: "160 84% 39%", secondary: "30 100% 55%", accent: "200 85% 55%", bg: "150 10% 3%" },
  { name: "Raspberry", primary: "340 70% 50%", secondary: "300 75% 50%", accent: "0 0% 85%", bg: "335 12% 3%" },
  { name: "Carbon", primary: "0 0% 55%", secondary: "0 0% 35%", accent: "45 100% 50%", bg: "0 0% 2%" },
  { name: "Flamingo", primary: "350 80% 60%", secondary: "25 80% 65%", accent: "45 100% 50%", bg: "345 8% 3%" },
  { name: "Graphite", primary: "0 0% 60%", secondary: "220 90% 56%", accent: "38 92% 50%", bg: "0 0% 3%" },
  { name: "Cotton Candy", primary: "300 60% 65%", secondary: "190 85% 50%", accent: "330 80% 55%", bg: "295 8% 4%" },
  { name: "Rustic", primary: "20 70% 50%", secondary: "80 40% 40%", accent: "33 55% 45%", bg: "15 10% 3%" },
  { name: "Seraph", primary: "45 100% 50%", secondary: "0 0% 85%", accent: "220 90% 56%", bg: "40 10% 3%" },
  { name: "Jungle", primary: "120 50% 35%", secondary: "80 40% 40%", accent: "45 100% 50%", bg: "110 15% 3%" },
  { name: "Coral Reef", primary: "16 100% 66%", secondary: "174 72% 44%", accent: "45 100% 50%", bg: "15 8% 3%" },
  { name: "Midnight Jazz", primary: "240 80% 62%", secondary: "45 100% 50%", accent: "0 72% 51%", bg: "235 20% 3%" },
  { name: "Sakura", primary: "340 60% 55%", secondary: "0 0% 90%", accent: "160 60% 50%", bg: "335 8% 4%" },
  { name: "Cobalt", primary: "220 90% 56%", secondary: "180 70% 45%", accent: "0 0% 85%", bg: "225 15% 3%" },
  { name: "Brick", primary: "10 60% 45%", secondary: "30 55% 50%", accent: "45 100% 50%", bg: "8 10% 3%" },
  { name: "Spectrum", primary: "0 72% 51%", secondary: "160 84% 39%", accent: "240 80% 62%", bg: "0 0% 3%" },
  { name: "Opal", primary: "180 40% 60%", secondary: "270 40% 60%", accent: "340 50% 60%", bg: "190 8% 4%" },
  { name: "Iron", primary: "210 14% 53%", secondary: "25 95% 53%", accent: "45 100% 50%", bg: "210 10% 4%" },
  { name: "Peach Sunset", primary: "20 80% 65%", secondary: "350 65% 55%", accent: "45 100% 50%", bg: "18 8% 4%" },
  { name: "Deep Sea", primary: "200 85% 55%", secondary: "160 84% 39%", accent: "0 0% 85%", bg: "205 15% 3%" },
  { name: "Mahogany", primary: "10 50% 35%", secondary: "33 55% 45%", accent: "45 100% 50%", bg: "8 10% 3%" },
  { name: "Citrus", primary: "45 100% 50%", secondary: "90 76% 45%", accent: "25 95% 53%", bg: "55 10% 3%" },
  { name: "Amethyst", primary: "270 76% 53%", secondary: "260 50% 65%", accent: "0 0% 85%", bg: "265 15% 3%" },
  { name: "Terracotta", primary: "15 55% 50%", secondary: "33 55% 45%", accent: "160 50% 55%", bg: "12 10% 3%" },
  { name: "Skyline", primary: "210 100% 60%", secondary: "200 85% 55%", accent: "0 0% 90%", bg: "215 12% 3%" },
  { name: "Papaya", primary: "25 100% 60%", secondary: "350 65% 55%", accent: "160 84% 39%", bg: "22 10% 3%" },
  { name: "Charcoal", primary: "0 0% 45%", secondary: "0 0% 65%", accent: "200 85% 55%", bg: "0 0% 3%" },
  { name: "Fuchsia", primary: "300 75% 50%", secondary: "330 80% 55%", accent: "260 50% 65%", bg: "305 12% 3%" },
  { name: "Driftwood", primary: "33 30% 45%", secondary: "20 30% 40%", accent: "160 50% 55%", bg: "30 8% 3%" },
  { name: "Tangerine Dream", primary: "30 100% 55%", secondary: "45 100% 50%", accent: "0 72% 51%", bg: "25 10% 3%" },
  { name: "Sage", primary: "130 20% 50%", secondary: "160 30% 45%", accent: "45 100% 50%", bg: "125 10% 3%" },
  { name: "Lemonade", primary: "55 80% 55%", secondary: "90 76% 45%", accent: "25 95% 53%", bg: "60 10% 3%" },
  { name: "Meteor", primary: "200 85% 55%", secondary: "0 72% 51%", accent: "45 100% 50%", bg: "210 12% 3%" },
  { name: "Orchid", primary: "280 50% 55%", secondary: "330 80% 55%", accent: "0 0% 85%", bg: "275 10% 3%" },
  { name: "Sienna", primary: "20 55% 45%", secondary: "0 72% 51%", accent: "45 100% 50%", bg: "18 10% 3%" },
  { name: "Electric Violet", primary: "280 100% 60%", secondary: "300 100% 50%", accent: "190 85% 50%", bg: "275 15% 3%" },
  { name: "Pearl", primary: "0 0% 85%", secondary: "210 14% 53%", accent: "45 100% 50%", bg: "0 0% 4%" },
  { name: "Watermelon", primary: "350 80% 55%", secondary: "90 76% 45%", accent: "0 0% 90%", bg: "345 10% 3%" },
  { name: "Aztec", primary: "30 100% 55%", secondary: "174 72% 44%", accent: "0 72% 51%", bg: "25 10% 3%" },
  { name: "Fog", primary: "210 10% 60%", secondary: "200 15% 50%", accent: "220 90% 56%", bg: "215 8% 4%" },
  { name: "Clover", primary: "140 50% 35%", secondary: "90 40% 50%", accent: "45 100% 50%", bg: "135 10% 3%" },
  { name: "Candy Apple", primary: "0 72% 51%", secondary: "120 60% 45%", accent: "0 0% 90%", bg: "355 10% 3%" },
  { name: "Blueberry", primary: "240 80% 62%", secondary: "270 76% 53%", accent: "0 0% 85%", bg: "245 15% 3%" },
  { name: "Cocoa", primary: "20 30% 35%", secondary: "33 55% 45%", accent: "20 80% 65%", bg: "18 8% 3%" },
  { name: "Lightning", primary: "55 100% 55%", secondary: "220 90% 56%", accent: "0 0% 85%", bg: "50 10% 3%" },
  { name: "Moss", primary: "100 30% 40%", secondary: "80 40% 40%", accent: "33 55% 45%", bg: "95 10% 3%" },
  { name: "Neon Rose", primary: "330 100% 55%", secondary: "270 76% 53%", accent: "180 100% 50%", bg: "325 12% 3%" },
  { name: "Sapphire Night", primary: "225 73% 57%", secondary: "200 85% 55%", accent: "0 0% 85%", bg: "228 15% 3%" },
  { name: "Butterscotch", primary: "38 80% 55%", secondary: "20 70% 50%", accent: "0 0% 85%", bg: "35 10% 3%" },
  { name: "Frost Bite", primary: "190 85% 50%", secondary: "280 68% 55%", accent: "0 0% 90%", bg: "195 10% 3%" },
  { name: "Chestnut", primary: "15 40% 38%", secondary: "33 55% 45%", accent: "45 100% 50%", bg: "12 10% 3%" },
  { name: "Sunstone", primary: "25 80% 55%", secondary: "45 100% 50%", accent: "350 65% 55%", bg: "22 10% 3%" },
  { name: "Iris", primary: "260 60% 55%", secondary: "220 90% 56%", accent: "330 80% 55%", bg: "258 12% 3%" },
  { name: "Mercury", primary: "0 0% 70%", secondary: "210 14% 53%", accent: "200 85% 55%", bg: "0 0% 3%" },
  { name: "Apricot", primary: "28 85% 60%", secondary: "350 65% 55%", accent: "160 50% 55%", bg: "25 8% 3%" },
  { name: "Indigo Night", primary: "240 80% 62%", secondary: "180 70% 45%", accent: "45 100% 50%", bg: "238 18% 3%" },
  { name: "Redwood", primary: "5 50% 40%", secondary: "33 55% 45%", accent: "80 40% 40%", bg: "3 10% 3%" },
  { name: "Electric Ocean", primary: "195 100% 50%", secondary: "160 84% 39%", accent: "300 75% 50%", bg: "200 12% 3%" },
  { name: "Praline", primary: "25 40% 50%", secondary: "38 55% 55%", accent: "0 0% 85%", bg: "22 8% 3%" },
  { name: "Arctic Fire", primary: "200 85% 55%", secondary: "0 72% 51%", accent: "0 0% 85%", bg: "205 10% 3%" },
  { name: "Plum Wine", primary: "290 47% 43%", secondary: "345 55% 35%", accent: "45 100% 50%", bg: "288 12% 3%" },
  { name: "Solar Wind", primary: "45 100% 50%", secondary: "180 100% 50%", accent: "300 75% 50%", bg: "50 10% 3%" },
  { name: "Winterberry", primary: "348 60% 45%", secondary: "200 85% 55%", accent: "0 0% 85%", bg: "345 10% 3%" },
  { name: "Horizon", primary: "200 85% 55%", secondary: "25 95% 53%", accent: "45 100% 50%", bg: "210 10% 3%" },
  { name: "Ember Night", primary: "15 70% 50%", secondary: "0 0% 65%", accent: "45 100% 50%", bg: "12 10% 3%" },
  { name: "Celestial", primary: "220 90% 56%", secondary: "270 76% 53%", accent: "0 0% 90%", bg: "225 15% 3%" },
  { name: "Cayenne", primary: "5 80% 45%", secondary: "25 95% 53%", accent: "45 100% 50%", bg: "3 12% 3%" },
  { name: "Kingfisher", primary: "195 80% 45%", secondary: "30 100% 55%", accent: "0 0% 85%", bg: "190 12% 3%" },
  { name: "Sandstorm", primary: "38 70% 55%", secondary: "20 50% 50%", accent: "0 72% 51%", bg: "35 8% 3%" },
  { name: "Neon Jungle", primary: "120 80% 50%", secondary: "300 100% 50%", accent: "55 100% 55%", bg: "115 12% 3%" },
  { name: "Blush", primary: "350 60% 60%", secondary: "20 80% 65%", accent: "0 0% 90%", bg: "345 8% 4%" },
  { name: "Glacier Blue", primary: "200 70% 60%", secondary: "210 60% 50%", accent: "0 0% 85%", bg: "205 10% 4%" },
  { name: "Volcanic Ash", primary: "0 0% 50%", secondary: "0 72% 51%", accent: "25 95% 53%", bg: "0 0% 3%" },
  { name: "Starlight", primary: "45 60% 70%", secondary: "220 90% 56%", accent: "0 0% 90%", bg: "40 5% 3%" },
  { name: "Vermillion", primary: "10 80% 55%", secondary: "38 92% 50%", accent: "0 0% 85%", bg: "8 10% 3%" },
  { name: "Kiwi", primary: "85 60% 50%", secondary: "120 50% 35%", accent: "45 100% 50%", bg: "88 10% 3%" },
  { name: "Midnight Sun", primary: "45 100% 50%", secondary: "220 90% 56%", accent: "0 72% 51%", bg: "0 0% 3%" },
  { name: "Eucalyptus", primary: "155 30% 50%", secondary: "180 40% 45%", accent: "0 0% 85%", bg: "150 8% 3%" },
  { name: "Mulberry", primary: "320 50% 45%", secondary: "270 50% 50%", accent: "45 100% 50%", bg: "315 10% 3%" },
  { name: "Citrine", primary: "50 90% 55%", secondary: "38 92% 50%", accent: "0 72% 51%", bg: "48 10% 3%" },
  { name: "Titanium Blue", primary: "210 30% 55%", secondary: "220 90% 56%", accent: "0 0% 80%", bg: "212 10% 4%" },
  { name: "Pumpkin", primary: "25 85% 55%", secondary: "45 100% 50%", accent: "160 50% 40%", bg: "22 10% 3%" },
  { name: "Hyacinth", primary: "260 50% 55%", secondary: "220 60% 55%", accent: "330 60% 55%", bg: "258 10% 3%" },
  { name: "Iron Oxide", primary: "15 50% 40%", secondary: "0 0% 55%", accent: "38 60% 50%", bg: "12 8% 3%" },
  { name: "Neon Sunset", primary: "25 100% 55%", secondary: "330 100% 55%", accent: "45 100% 55%", bg: "20 10% 3%" },
  { name: "Dove", primary: "0 0% 70%", secondary: "200 30% 55%", accent: "0 0% 90%", bg: "0 0% 4%" },
  { name: "Topaz", primary: "38 80% 55%", secondary: "200 85% 55%", accent: "0 0% 85%", bg: "35 8% 3%" },
  { name: "Cerulean", primary: "200 80% 50%", secondary: "180 60% 45%", accent: "0 0% 85%", bg: "205 12% 3%" },
  { name: "Cherry Cola", primary: "348 83% 47%", secondary: "20 70% 50%", accent: "0 0% 85%", bg: "345 10% 3%" },
  { name: "Zen Garden", primary: "130 20% 50%", secondary: "0 0% 75%", accent: "45 40% 55%", bg: "125 8% 3%" },
  { name: "Candy Corn", primary: "38 92% 50%", secondary: "25 95% 53%", accent: "0 0% 95%", bg: "35 10% 3%" },
  { name: "Phantom", primary: "270 40% 45%", secondary: "0 0% 60%", accent: "200 85% 55%", bg: "265 10% 3%" },
  { name: "Tuscan Sun", primary: "38 70% 55%", secondary: "15 55% 50%", accent: "160 30% 45%", bg: "35 8% 3%" },
  { name: "Snowfall", primary: "210 20% 65%", secondary: "0 0% 85%", accent: "200 85% 55%", bg: "215 8% 4%" },
  { name: "Cactus", primary: "120 30% 40%", secondary: "38 50% 50%", accent: "0 72% 51%", bg: "115 10% 3%" },
  { name: "Neon Grape", primary: "270 100% 60%", secondary: "300 100% 50%", accent: "55 100% 55%", bg: "268 15% 3%" },
  { name: "Marble", primary: "0 0% 80%", secondary: "45 20% 60%", accent: "220 90% 56%", bg: "0 0% 4%" },
  { name: "Sunkissed", primary: "30 80% 60%", secondary: "350 60% 55%", accent: "0 0% 90%", bg: "28 8% 3%" },
  { name: "Raven", primary: "260 20% 40%", secondary: "0 0% 55%", accent: "270 76% 53%", bg: "255 10% 3%" },
  { name: "Sherbet", primary: "25 90% 60%", secondary: "340 60% 55%", accent: "160 60% 50%", bg: "22 8% 3%" },
  // Light 3-color schemes (20)
  { name: "Classic Light", primary: "220 70% 50%", secondary: "200 60% 55%", accent: "45 80% 50%", bg: "0 0% 98%", light: true },
  { name: "Warm Light", primary: "25 90% 50%", secondary: "350 60% 55%", accent: "45 100% 50%", bg: "30 20% 96%", light: true },
  { name: "Cool Breeze", primary: "200 80% 50%", secondary: "180 60% 45%", accent: "270 50% 55%", bg: "200 10% 97%", light: true },
  { name: "Garden Light", primary: "140 60% 40%", secondary: "80 40% 45%", accent: "45 80% 50%", bg: "140 10% 97%", light: true },
  { name: "Pastel Rose", primary: "340 60% 55%", secondary: "270 50% 60%", accent: "200 60% 55%", bg: "340 15% 96%", light: true },
  { name: "Pastel Sky", primary: "210 60% 55%", secondary: "190 50% 50%", accent: "45 60% 55%", bg: "210 15% 96%", light: true },
  { name: "Peach Light", primary: "20 80% 55%", secondary: "350 55% 55%", accent: "160 50% 45%", bg: "25 15% 96%", light: true },
  { name: "Lavender Light", primary: "260 50% 60%", secondary: "220 60% 55%", accent: "330 50% 55%", bg: "260 10% 97%", light: true },
  { name: "Mint Light", primary: "160 50% 45%", secondary: "140 40% 40%", accent: "45 80% 50%", bg: "155 10% 97%", light: true },
  { name: "Citrus Light", primary: "45 90% 50%", secondary: "25 80% 55%", accent: "160 50% 45%", bg: "50 15% 96%", light: true },
  { name: "Coral Light", primary: "16 80% 55%", secondary: "174 50% 45%", accent: "220 60% 55%", bg: "15 10% 97%", light: true },
  { name: "Lilac Light", primary: "280 50% 60%", secondary: "330 50% 55%", accent: "200 60% 55%", bg: "275 10% 97%", light: true },
  { name: "Honey Light", primary: "38 80% 50%", secondary: "20 60% 50%", accent: "160 40% 45%", bg: "35 15% 96%", light: true },
  { name: "Berry Light", primary: "340 60% 50%", secondary: "270 50% 55%", accent: "45 70% 55%", bg: "335 12% 96%", light: true },
  { name: "Ocean Light", primary: "195 70% 45%", secondary: "160 50% 45%", accent: "25 70% 55%", bg: "200 10% 97%", light: true },
  { name: "Sunset Light", primary: "25 85% 55%", secondary: "0 60% 50%", accent: "45 90% 50%", bg: "20 15% 96%", light: true },
  { name: "Sage Light", primary: "130 25% 50%", secondary: "80 20% 50%", accent: "38 60% 55%", bg: "125 8% 97%", light: true },
  { name: "Blush Light", primary: "350 55% 60%", secondary: "20 60% 60%", accent: "200 50% 55%", bg: "345 10% 97%", light: true },
  { name: "Aqua Light", primary: "180 60% 45%", secondary: "200 60% 50%", accent: "330 50% 55%", bg: "185 10% 97%", light: true },
  { name: "Sand Light", primary: "38 50% 55%", secondary: "20 40% 50%", accent: "200 60% 50%", bg: "35 10% 97%", light: true },
];

type SettingsTab = "main" | "theme" | "layout" | "wearables" | "privacy" | "language" | "notifications" | "help";

interface LayoutOption {
  name: string;
  gridCols: number;
  tileStyle: string;
  iconSize: string;
  fontSize: string;
  gap: string;
  borderRadius: string;
  category: string;
}

const LAYOUT_OPTIONS: LayoutOption[] = [
  // Grid layouts
  { name: "Standard 4x", gridCols: 4, tileStyle: "compact", iconSize: "w-6 h-6", fontSize: "text-[10px]", gap: "gap-3", borderRadius: "rounded-xl", category: "Grid" },
  { name: "Large 3x", gridCols: 3, tileStyle: "large", iconSize: "w-8 h-8", fontSize: "text-xs", gap: "gap-3", borderRadius: "rounded-xl", category: "Grid" },
  { name: "Big 2x", gridCols: 2, tileStyle: "extra-large", iconSize: "w-10 h-10", fontSize: "text-sm", gap: "gap-3", borderRadius: "rounded-2xl", category: "Grid" },
  { name: "Dense 5x", gridCols: 5, tileStyle: "tiny", iconSize: "w-5 h-5", fontSize: "text-[8px]", gap: "gap-1.5", borderRadius: "rounded-lg", category: "Grid" },
  { name: "Micro 6x", gridCols: 6, tileStyle: "micro", iconSize: "w-4 h-4", fontSize: "text-[7px]", gap: "gap-1", borderRadius: "rounded-md", category: "Grid" },
  { name: "Cozy 3x", gridCols: 3, tileStyle: "compact", iconSize: "w-7 h-7", fontSize: "text-[11px]", gap: "gap-4", borderRadius: "rounded-2xl", category: "Grid" },
  { name: "Spacious 2x", gridCols: 2, tileStyle: "large", iconSize: "w-12 h-12", fontSize: "text-sm", gap: "gap-4", borderRadius: "rounded-3xl", category: "Grid" },
  { name: "Tight 4x", gridCols: 4, tileStyle: "compact", iconSize: "w-5 h-5", fontSize: "text-[9px]", gap: "gap-1.5", borderRadius: "rounded-lg", category: "Grid" },
  { name: "Balanced 3x", gridCols: 3, tileStyle: "compact", iconSize: "w-6 h-6", fontSize: "text-[10px]", gap: "gap-2", borderRadius: "rounded-xl", category: "Grid" },
  { name: "Ultra Dense 4x", gridCols: 4, tileStyle: "tiny", iconSize: "w-4 h-4", fontSize: "text-[8px]", gap: "gap-1", borderRadius: "rounded-md", category: "Grid" },
  // Rounded
  { name: "Bubble 3x", gridCols: 3, tileStyle: "compact", iconSize: "w-7 h-7", fontSize: "text-[10px]", gap: "gap-3", borderRadius: "rounded-full", category: "Rounded" },
  { name: "Pill 4x", gridCols: 4, tileStyle: "compact", iconSize: "w-6 h-6", fontSize: "text-[10px]", gap: "gap-2", borderRadius: "rounded-full", category: "Rounded" },
  { name: "Soft 3x", gridCols: 3, tileStyle: "large", iconSize: "w-8 h-8", fontSize: "text-xs", gap: "gap-3", borderRadius: "rounded-3xl", category: "Rounded" },
  { name: "Circle 2x", gridCols: 2, tileStyle: "extra-large", iconSize: "w-10 h-10", fontSize: "text-sm", gap: "gap-4", borderRadius: "rounded-full", category: "Rounded" },
  { name: "Capsule 4x", gridCols: 4, tileStyle: "compact", iconSize: "w-5 h-5", fontSize: "text-[9px]", gap: "gap-2", borderRadius: "rounded-3xl", category: "Rounded" },
  { name: "Orb 3x", gridCols: 3, tileStyle: "compact", iconSize: "w-7 h-7", fontSize: "text-[10px]", gap: "gap-4", borderRadius: "rounded-full", category: "Rounded" },
  { name: "Dome 2x", gridCols: 2, tileStyle: "large", iconSize: "w-9 h-9", fontSize: "text-xs", gap: "gap-3", borderRadius: "rounded-3xl", category: "Rounded" },
  { name: "Smooth 5x", gridCols: 5, tileStyle: "tiny", iconSize: "w-5 h-5", fontSize: "text-[8px]", gap: "gap-1.5", borderRadius: "rounded-2xl", category: "Rounded" },
  { name: "Cloud 3x", gridCols: 3, tileStyle: "compact", iconSize: "w-6 h-6", fontSize: "text-[10px]", gap: "gap-3", borderRadius: "rounded-[20px]", category: "Rounded" },
  { name: "Pebble 4x", gridCols: 4, tileStyle: "compact", iconSize: "w-6 h-6", fontSize: "text-[10px]", gap: "gap-2.5", borderRadius: "rounded-[16px]", category: "Rounded" },
  // Sharp
  { name: "Sharp 4x", gridCols: 4, tileStyle: "compact", iconSize: "w-6 h-6", fontSize: "text-[10px]", gap: "gap-3", borderRadius: "rounded-none", category: "Sharp" },
  { name: "Edge 3x", gridCols: 3, tileStyle: "large", iconSize: "w-8 h-8", fontSize: "text-xs", gap: "gap-3", borderRadius: "rounded-sm", category: "Sharp" },
  { name: "Block 2x", gridCols: 2, tileStyle: "extra-large", iconSize: "w-10 h-10", fontSize: "text-sm", gap: "gap-3", borderRadius: "rounded-none", category: "Sharp" },
  { name: "Pixel 5x", gridCols: 5, tileStyle: "tiny", iconSize: "w-5 h-5", fontSize: "text-[8px]", gap: "gap-1", borderRadius: "rounded-none", category: "Sharp" },
  { name: "Tile 4x", gridCols: 4, tileStyle: "compact", iconSize: "w-5 h-5", fontSize: "text-[9px]", gap: "gap-1", borderRadius: "rounded-sm", category: "Sharp" },
  { name: "Slate 3x", gridCols: 3, tileStyle: "compact", iconSize: "w-7 h-7", fontSize: "text-[11px]", gap: "gap-2", borderRadius: "rounded-sm", category: "Sharp" },
  { name: "Angular 2x", gridCols: 2, tileStyle: "large", iconSize: "w-9 h-9", fontSize: "text-sm", gap: "gap-2", borderRadius: "rounded-none", category: "Sharp" },
  { name: "Crisp 4x", gridCols: 4, tileStyle: "compact", iconSize: "w-6 h-6", fontSize: "text-[10px]", gap: "gap-2.5", borderRadius: "rounded-[4px]", category: "Sharp" },
  { name: "Metro 3x", gridCols: 3, tileStyle: "large", iconSize: "w-8 h-8", fontSize: "text-xs", gap: "gap-1.5", borderRadius: "rounded-none", category: "Sharp" },
  { name: "Box 6x", gridCols: 6, tileStyle: "micro", iconSize: "w-4 h-4", fontSize: "text-[7px]", gap: "gap-0.5", borderRadius: "rounded-none", category: "Sharp" },
  // Minimal
  { name: "Zen 3x", gridCols: 3, tileStyle: "compact", iconSize: "w-6 h-6", fontSize: "text-[10px]", gap: "gap-6", borderRadius: "rounded-xl", category: "Minimal" },
  { name: "Clean 2x", gridCols: 2, tileStyle: "large", iconSize: "w-8 h-8", fontSize: "text-xs", gap: "gap-6", borderRadius: "rounded-xl", category: "Minimal" },
  { name: "Airy 3x", gridCols: 3, tileStyle: "compact", iconSize: "w-7 h-7", fontSize: "text-[10px]", gap: "gap-5", borderRadius: "rounded-2xl", category: "Minimal" },
  { name: "Breathe 4x", gridCols: 4, tileStyle: "compact", iconSize: "w-6 h-6", fontSize: "text-[10px]", gap: "gap-4", borderRadius: "rounded-xl", category: "Minimal" },
  { name: "Simple 2x", gridCols: 2, tileStyle: "extra-large", iconSize: "w-10 h-10", fontSize: "text-sm", gap: "gap-5", borderRadius: "rounded-xl", category: "Minimal" },
  { name: "Calm 3x", gridCols: 3, tileStyle: "large", iconSize: "w-8 h-8", fontSize: "text-xs", gap: "gap-4", borderRadius: "rounded-2xl", category: "Minimal" },
  { name: "Float 4x", gridCols: 4, tileStyle: "compact", iconSize: "w-5 h-5", fontSize: "text-[9px]", gap: "gap-5", borderRadius: "rounded-2xl", category: "Minimal" },
  { name: "Whisper 2x", gridCols: 2, tileStyle: "large", iconSize: "w-9 h-9", fontSize: "text-sm", gap: "gap-6", borderRadius: "rounded-3xl", category: "Minimal" },
  { name: "Mist 3x", gridCols: 3, tileStyle: "compact", iconSize: "w-6 h-6", fontSize: "text-[10px]", gap: "gap-5", borderRadius: "rounded-full", category: "Minimal" },
  { name: "Serene 4x", gridCols: 4, tileStyle: "compact", iconSize: "w-6 h-6", fontSize: "text-[10px]", gap: "gap-4", borderRadius: "rounded-3xl", category: "Minimal" },
  // Bold
  { name: "Impact 2x", gridCols: 2, tileStyle: "extra-large", iconSize: "w-12 h-12", fontSize: "text-base", gap: "gap-3", borderRadius: "rounded-2xl", category: "Bold" },
  { name: "Power 3x", gridCols: 3, tileStyle: "large", iconSize: "w-9 h-9", fontSize: "text-sm", gap: "gap-2", borderRadius: "rounded-xl", category: "Bold" },
  { name: "Hero 2x", gridCols: 2, tileStyle: "extra-large", iconSize: "w-14 h-14", fontSize: "text-lg", gap: "gap-4", borderRadius: "rounded-3xl", category: "Bold" },
  { name: "Mega 1x", gridCols: 1, tileStyle: "extra-large", iconSize: "w-10 h-10", fontSize: "text-base", gap: "gap-2", borderRadius: "rounded-2xl", category: "Bold" },
  { name: "Titan 2x", gridCols: 2, tileStyle: "large", iconSize: "w-10 h-10", fontSize: "text-sm", gap: "gap-3", borderRadius: "rounded-xl", category: "Bold" },
  { name: "Giant 3x", gridCols: 3, tileStyle: "large", iconSize: "w-8 h-8", fontSize: "text-xs", gap: "gap-3", borderRadius: "rounded-2xl", category: "Bold" },
  { name: "King 2x", gridCols: 2, tileStyle: "extra-large", iconSize: "w-11 h-11", fontSize: "text-sm", gap: "gap-4", borderRadius: "rounded-xl", category: "Bold" },
  { name: "Force 3x", gridCols: 3, tileStyle: "large", iconSize: "w-9 h-9", fontSize: "text-sm", gap: "gap-2.5", borderRadius: "rounded-3xl", category: "Bold" },
  { name: "Max 4x", gridCols: 4, tileStyle: "compact", iconSize: "w-7 h-7", fontSize: "text-[11px]", gap: "gap-2", borderRadius: "rounded-xl", category: "Bold" },
  { name: "Thunder 3x", gridCols: 3, tileStyle: "large", iconSize: "w-10 h-10", fontSize: "text-sm", gap: "gap-3", borderRadius: "rounded-2xl", category: "Bold" },
  // Elegant
  { name: "Luxe 3x", gridCols: 3, tileStyle: "compact", iconSize: "w-7 h-7", fontSize: "text-[10px]", gap: "gap-3", borderRadius: "rounded-[14px]", category: "Elegant" },
  { name: "Silk 4x", gridCols: 4, tileStyle: "compact", iconSize: "w-6 h-6", fontSize: "text-[10px]", gap: "gap-3", borderRadius: "rounded-[12px]", category: "Elegant" },
  { name: "Velvet 2x", gridCols: 2, tileStyle: "large", iconSize: "w-9 h-9", fontSize: "text-xs", gap: "gap-4", borderRadius: "rounded-[18px]", category: "Elegant" },
  { name: "Pearl 3x", gridCols: 3, tileStyle: "compact", iconSize: "w-6 h-6", fontSize: "text-[10px]", gap: "gap-4", borderRadius: "rounded-[16px]", category: "Elegant" },
  { name: "Crystal 4x", gridCols: 4, tileStyle: "compact", iconSize: "w-5 h-5", fontSize: "text-[9px]", gap: "gap-2.5", borderRadius: "rounded-[10px]", category: "Elegant" },
  { name: "Satin 3x", gridCols: 3, tileStyle: "large", iconSize: "w-8 h-8", fontSize: "text-xs", gap: "gap-3.5", borderRadius: "rounded-[14px]", category: "Elegant" },
  { name: "Grace 2x", gridCols: 2, tileStyle: "extra-large", iconSize: "w-10 h-10", fontSize: "text-sm", gap: "gap-5", borderRadius: "rounded-[20px]", category: "Elegant" },
  { name: "Charm 5x", gridCols: 5, tileStyle: "tiny", iconSize: "w-5 h-5", fontSize: "text-[8px]", gap: "gap-2", borderRadius: "rounded-[10px]", category: "Elegant" },
  { name: "Noble 3x", gridCols: 3, tileStyle: "compact", iconSize: "w-7 h-7", fontSize: "text-[11px]", gap: "gap-3", borderRadius: "rounded-[16px]", category: "Elegant" },
  { name: "Regal 4x", gridCols: 4, tileStyle: "compact", iconSize: "w-6 h-6", fontSize: "text-[10px]", gap: "gap-3.5", borderRadius: "rounded-[14px]", category: "Elegant" },
];

const LANGUAGES = ["English", "Spanish", "French", "German", "Japanese", "Korean", "Chinese", "Portuguese", "Italian", "Arabic", "Hindi", "Russian"];

const SettingsPage = () => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<SettingsTab>("main");
  const [pairedDevices, setPairedDevices] = useState<PairedDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [connectedDevices, setConnectedDevices] = useState<string[]>([]);
  const [currentTheme, setCurrentTheme] = useState("Gold & Black");
  const [language, setLanguage] = useState("English");
  const [privacySettings, setPrivacySettings] = useState({ shareData: false, locationTracking: true, crashReports: true, personalizedAds: true });
  const { subscribed } = useSubscription();
  const [currentLayout, setCurrentLayout] = useState("Standard 4x");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) return;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      setIsAdmin(!!data);
    };
    checkAdmin();
  }, [user]);

  const applyLayout = (layout: LayoutOption) => {
    // Store layout in localStorage so DashboardPage can read it
    localStorage.setItem("solace-layout", JSON.stringify(layout));
    setCurrentLayout(layout.name);
    toast.success(`Layout: ${layout.name}`);
    // Dispatch custom event so dashboard picks it up in real-time
    window.dispatchEvent(new CustomEvent("solace-layout-change", { detail: layout }));
  };

  const handleLogout = async () => { await signOut(); toast.success("Signed out"); navigate("/"); };

  const scanBluetooth = useCallback(async () => {
    if (!(navigator as any).bluetooth) {
      toast.error("Bluetooth not supported in this browser. Use Chrome on Android or desktop.");
      return;
    }
    setIsScanning(true);
    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ["heart_rate", "battery_service", "device_information", "health_thermometer", "running_speed_and_cadence"],
      });
      if (!device) { setIsScanning(false); return; }

      let battery: number | undefined;
      let gattServer: any;
      try {
        gattServer = await device.gatt?.connect();
        try {
          const batteryService = await gattServer?.getPrimaryService("battery_service");
          const batteryChar = await batteryService?.getCharacteristic("battery_level");
          const val = await batteryChar?.readValue();
          battery = val?.getUint8(0);
        } catch { /* device may not support battery service */ }
      } catch { /* GATT connection optional */ }

      const newDevice: PairedDevice = {
        id: device.id || Date.now().toString(),
        name: device.name || "Unknown Device",
        type: "watch",
        icon: "⌚",
        connected: !!gattServer?.connected,
        battery,
        lastSeen: new Date().toLocaleTimeString(),
        gattServer,
      };

      // Match to known wearable type
      const known = KNOWN_WEARABLES.find(w => device.name?.toLowerCase().includes(w.name.split(" ")[0].toLowerCase()));
      if (known) { newDevice.icon = known.icon; newDevice.type = known.type; }

      setPairedDevices(prev => {
        const exists = prev.find(d => d.id === newDevice.id);
        if (exists) return prev.map(d => d.id === newDevice.id ? newDevice : d);
        return [...prev, newDevice];
      });
      setConnectedDevices(prev => prev.includes(newDevice.name) ? prev : [...prev, newDevice.name]);
      toast.success(`${newDevice.name} paired successfully!${battery !== undefined ? ` Battery: ${battery}%` : ""}`);
    } catch (e: any) {
      if (e.name !== "NotFoundError") toast.error(e.message || "Bluetooth scan failed");
    } finally { setIsScanning(false); }
  }, []);

  const disconnectDevice = useCallback((device: PairedDevice) => {
    try { device.gattServer?.disconnect(); } catch {}
    setPairedDevices(prev => prev.filter(d => d.id !== device.id));
    setConnectedDevices(prev => prev.filter(n => n !== device.name));
    toast.success(`${device.name} disconnected`);
  }, []);

  const applyTheme = (theme: ThemeScheme) => {
    const root = document.documentElement;
    root.style.setProperty("--primary", theme.primary);
    root.style.setProperty("--secondary", theme.secondary);
    root.style.setProperty("--accent", theme.accent);
    root.style.setProperty("--background", theme.bg);
    root.style.setProperty("--ring", theme.primary);
    root.style.setProperty("--gold", theme.primary);
    if (theme.light) {
      root.style.setProperty("--foreground", "0 0% 10%");
      root.style.setProperty("--card", "0 0% 100%");
      root.style.setProperty("--card-foreground", "0 0% 10%");
      root.style.setProperty("--muted-foreground", "0 0% 40%");
      root.style.setProperty("--border", `${theme.primary.split(" ")[0]} 20% 80%`);
    } else {
      root.style.setProperty("--foreground", theme.primary);
      root.style.setProperty("--card", theme.bg.replace(/\d+%$/, (m) => `${Math.min(parseInt(m) + 5, 15)}%`));
      root.style.setProperty("--card-foreground", theme.primary);
      root.style.setProperty("--muted-foreground", `${theme.primary.split(" ")[0]} 30% 55%`);
      root.style.setProperty("--border", `${theme.primary.split(" ")[0]} 60% 20%`);
    }
    setCurrentTheme(theme.name);
    toast.success(`Theme: ${theme.name}`);
  };

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!value)} className={`w-10 h-6 rounded-full transition-colors relative ${value ? "bg-primary" : "bg-muted"}`}>
      <div className={`w-4 h-4 rounded-full bg-primary-foreground absolute top-1 transition-transform ${value ? "translate-x-5" : "translate-x-1"}`} />
    </button>
  );

  if (tab !== "main") {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="px-4 pt-4 pb-4">
          <button onClick={() => setTab("main")} className="flex items-center gap-2 text-sm text-primary mb-4"><ArrowLeft className="w-4 h-4" /> Settings</button>

          {tab === "theme" && (
            <>
              <h1 className="text-lg font-bold text-primary mb-4">Theme & Colors</h1>
              <p className="text-xs text-muted-foreground mb-4">Current: <span className="text-primary font-medium">{currentTheme}</span> · {THEME_COLORS.length} schemes</p>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Dark Themes ({THEME_COLORS.filter(t => !t.light).length})</h3>
              <div className="grid grid-cols-3 gap-2 mb-4 max-h-[60vh] overflow-y-auto pr-1">
                {THEME_COLORS.filter(t => !t.light).map(t => (
                  <button key={t.name} onClick={() => applyTheme(t)} className={`p-2 rounded-xl border text-center transition-all ${currentTheme === t.name ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border bg-card"}`}>
                    <div className="flex justify-center gap-1 mb-1">
                      <div className="w-5 h-5 rounded-full" style={{ background: `hsl(${t.primary})` }} />
                      <div className="w-5 h-5 rounded-full" style={{ background: `hsl(${t.secondary})` }} />
                      <div className="w-5 h-5 rounded-full" style={{ background: `hsl(${t.accent})` }} />
                    </div>
                    <span className="text-[8px] text-foreground leading-tight block">{t.name}</span>
                    {currentTheme === t.name && <Check className="w-3 h-3 text-primary mx-auto mt-0.5" />}
                  </button>
                ))}
              </div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Light Themes ({THEME_COLORS.filter(t => t.light).length})</h3>
              <div className="grid grid-cols-3 gap-2">
                {THEME_COLORS.filter(t => t.light).map(t => (
                  <button key={t.name} onClick={() => applyTheme(t)} className={`p-2 rounded-xl border text-center transition-all ${currentTheme === t.name ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border bg-card"}`}>
                    <div className="flex justify-center gap-1 mb-1">
                      <div className="w-5 h-5 rounded-full border border-border/50" style={{ background: `hsl(${t.primary})` }} />
                      <div className="w-5 h-5 rounded-full border border-border/50" style={{ background: `hsl(${t.secondary})` }} />
                      <div className="w-5 h-5 rounded-full border border-border/50" style={{ background: `hsl(${t.accent})` }} />
                    </div>
                    <span className="text-[8px] text-foreground leading-tight block">{t.name}</span>
                    {currentTheme === t.name && <Check className="w-3 h-3 text-primary mx-auto mt-0.5" />}
                  </button>
                ))}
              </div>
            </>
          )}

          {tab === "layout" && (
            <>
              <h1 className="text-lg font-bold text-primary mb-4">App Layout</h1>
              <p className="text-xs text-muted-foreground mb-4">Current: <span className="text-primary font-medium">{currentLayout}</span> · {LAYOUT_OPTIONS.length} layouts</p>
              {["Grid", "Rounded", "Sharp", "Minimal", "Bold", "Elegant"].map(cat => (
                <div key={cat} className="mb-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">{cat}</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {LAYOUT_OPTIONS.filter(l => l.category === cat).map(l => (
                      <button key={l.name} onClick={() => applyLayout(l)} className={`p-2.5 border text-center transition-all ${l.borderRadius} ${currentLayout === l.name ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border bg-card"}`}>
                        {/* Mini preview */}
                        <div className={`grid gap-[2px] mb-1.5 mx-auto w-fit`} style={{ gridTemplateColumns: `repeat(${Math.min(l.gridCols, 4)}, 1fr)` }}>
                          {Array.from({ length: Math.min(l.gridCols * 2, 12) }).map((_, i) => (
                            <div key={i} className={`w-2 h-2 bg-primary/40 ${l.borderRadius === "rounded-full" ? "rounded-full" : l.borderRadius === "rounded-none" ? "" : "rounded-sm"}`} />
                          ))}
                        </div>
                        <span className="text-[8px] text-foreground leading-tight block">{l.name}</span>
                        {currentLayout === l.name && <Check className="w-3 h-3 text-primary mx-auto mt-0.5" />}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}

          {tab === "wearables" && (
            <>
              <h1 className="text-lg font-bold text-primary mb-4">Wearable Devices</h1>
              
              {/* Scan button */}
              <button onClick={scanBluetooth} disabled={isScanning}
                className="w-full flex items-center justify-center gap-3 py-4 mb-4 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors disabled:opacity-50">
                {isScanning ? <Loader2 className="w-5 h-5 text-primary animate-spin" /> : <Bluetooth className="w-5 h-5 text-primary" />}
                <span className="text-sm font-medium text-primary">{isScanning ? "Scanning for devices..." : "Scan for Bluetooth Devices"}</span>
              </button>

              {/* Paired devices */}
              {pairedDevices.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Paired Devices</h3>
                  <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
                    {pairedDevices.map(device => (
                      <div key={device.id} className="flex items-center gap-3 px-4 py-3.5">
                        <span className="text-xl">{device.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground font-medium truncate">{device.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Signal className={`w-3 h-3 ${device.connected ? "text-green-500" : "text-muted-foreground"}`} />
                            <span className="text-[10px] text-muted-foreground">{device.connected ? "Connected" : "Disconnected"}</span>
                            {device.battery !== undefined && <span className="text-[10px] text-primary">🔋 {device.battery}%</span>}
                            {device.lastSeen && <span className="text-[10px] text-muted-foreground">• {device.lastSeen}</span>}
                          </div>
                        </div>
                        <button onClick={() => disconnectDevice(device)} className="p-1.5 rounded-full hover:bg-destructive/10"><X className="w-4 h-4 text-destructive" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Compatible devices info */}
              <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Compatible Devices</h3>
              <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
                {KNOWN_WEARABLES.map(w => {
                  const isPaired = pairedDevices.some(d => d.name.toLowerCase().includes(w.name.split(" ")[0].toLowerCase()));
                  return (
                    <div key={w.name} className="flex items-center gap-3 px-4 py-3 text-left">
                      <span className="text-xl">{w.icon}</span>
                      <span className="flex-1 text-sm text-foreground">{w.name}</span>
                      {isPaired ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 font-medium">Paired</span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Not paired</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Health data sync info */}
              <div className="mt-3 bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2"><Activity className="w-4 h-4 text-primary" /><h3 className="text-xs font-semibold text-foreground">Health Data Sync</h3></div>
                <p className="text-[10px] text-muted-foreground mb-2">Connected wearables sync heart rate, steps, sleep, and stress data to Mind Hub, Haptic Escape, and wellness features.</p>
                <div className="flex flex-wrap gap-1">
                  {["Heart Rate", "Steps", "Sleep", "SpO2", "Stress", "Calories", "Temperature"].map(metric => (
                    <span key={metric} className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{metric}</span>
                  ))}
                </div>
              </div>

              {/* Link another device */}
              <button onClick={scanBluetooth} className="w-full mt-3 py-3 text-sm font-medium text-primary bg-primary/5 border border-primary/20 rounded-xl hover:bg-primary/10 transition-colors">
                + Link Another Device
              </button>
            </>
          )}

          {tab === "privacy" && (
            <>
              <h1 className="text-lg font-bold text-primary mb-4">Privacy & Security</h1>
              <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
                {[
                  { label: "Share Analytics Data", key: "shareData" as const, desc: "Help improve Solace with anonymous usage data", locked: false },
                  { label: "Location Tracking", key: "locationTracking" as const, desc: "For Crisis Hub, Radar, and location-based features", locked: false },
                  { label: "Crash Reports", key: "crashReports" as const, desc: "Auto-send crash reports to improve stability", locked: false },
                  { label: "Personalized Ads", key: "personalizedAds" as const, desc: subscribed ? "Show relevant sponsored content" : "🔒 Subscribe to any plan to disable ads", locked: !subscribed },
                ].map(item => (
                  <div key={item.key} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="flex-1">
                      <p className="text-sm text-foreground flex items-center gap-1.5">
                        {item.label}
                        {item.locked && <Lock className="w-3 h-3 text-muted-foreground" />}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                    </div>
                    {item.locked ? (
                      <button onClick={() => navigate("/subscribe")} className="px-3 py-1 rounded-full text-[10px] font-medium bg-primary text-primary-foreground">
                        Upgrade
                      </button>
                    ) : (
                      <Toggle value={privacySettings[item.key]} onChange={v => setPrivacySettings(p => ({ ...p, [item.key]: v }))} />
                    )}
                  </div>
                ))}
              </div>
              <button className="w-full mt-4 py-3 bg-destructive/10 text-destructive font-medium rounded-xl text-sm">Delete Account</button>
            </>
          )}

          {tab === "language" && (
            <>
              <h1 className="text-lg font-bold text-primary mb-4">Language</h1>
              <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
                {LANGUAGES.map(l => (
                  <button key={l} onClick={() => { setLanguage(l); toast.success(`Language set to ${l}`); }} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/50 text-left">
                    <span className="flex-1 text-sm text-foreground">{l}</span>
                    {language === l && <Check className="w-4 h-4 text-primary" />}
                  </button>
                ))}
              </div>
            </>
          )}

          {tab === "notifications" && (
            <>
              <h1 className="text-lg font-bold text-primary mb-4">Notifications</h1>
              <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
                {[
                  { label: "Push Notifications", value: true, onChange: () => {} },
                  { label: "Sound Effects", value: true, onChange: () => {} },
                  { label: "Oracle Reminders", value: true, onChange: () => {} },
                  { label: "Calendar Alerts", value: true, onChange: () => {} },
                  { label: "Family Hub Updates", value: true, onChange: () => {} },
                  { label: "Marketing Notifications", value: false, onChange: () => {} },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3 px-4 py-3.5">
                    <span className="flex-1 text-sm text-foreground">{item.label}</span>
                    <Toggle value={item.value} onChange={item.onChange} />
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === "help" && (
            <>
              <h1 className="text-lg font-bold text-primary mb-4">Help & Support</h1>
              <div className="space-y-3">
                {[
                  { title: "FAQ", desc: "Common questions and answers" },
                  { title: "Contact Support", desc: "Get help from our team" },
                  { title: "Report a Bug", desc: "Let us know about issues" },
                  { title: "Feature Request", desc: "Suggest new features" },
                  { title: "Terms of Service", desc: "Our terms and policies" },
                  { title: "Privacy Policy", desc: "How we handle your data" },
                ].map(item => (
                  <button key={item.title} className="w-full bg-card border border-border rounded-xl p-4 text-left hover:border-primary transition-colors">
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }


  const sections = [
    { title: "Account", items: [
      { icon: <User className="w-5 h-5" />, label: "Profile", action: () => navigate("/profile") },
      { icon: <Shield className="w-5 h-5" />, label: "Privacy & Security", action: () => setTab("privacy") },
      { icon: <Bell className="w-5 h-5" />, label: "Notifications", action: () => setTab("notifications") },
      ...(isAdmin ? [{ icon: <Activity className="w-5 h-5" />, label: "Admin Dashboard", action: () => navigate("/owner-dashboard") }] : []),
    ]},
    { title: "Devices", items: [
      { icon: <Watch className="w-5 h-5" />, label: "Wearable Devices", subtitle: `${pairedDevices.length} paired`, action: () => setTab("wearables") },
      { icon: <Bluetooth className="w-5 h-5" />, label: "Scan Bluetooth", action: () => { setTab("wearables"); setTimeout(scanBluetooth, 300); } },
    ]},
    { title: "Preferences", items: [
      { icon: <Palette className="w-5 h-5" />, label: "Theme & Colors", subtitle: currentTheme, action: () => setTab("theme") },
      { icon: <LayoutGrid className="w-5 h-5" />, label: "App Layout", subtitle: currentLayout, action: () => setTab("layout") },
      { icon: <Globe className="w-5 h-5" />, label: "Language", subtitle: language, action: () => setTab("language") },
    ]},
    { title: "About", items: [
      { icon: <Smartphone className="w-5 h-5" />, label: "About Solace", action: () => navigate("/about") },
      { icon: <Shield className="w-5 h-5" />, label: "Privacy Policy", action: () => navigate("/privacy-policy") },
      { icon: <FileText className="w-5 h-5" />, label: "Terms of Service", action: () => navigate("/terms-of-service") },
      { icon: <HelpCircle className="w-5 h-5" />, label: "Help & Support", action: () => setTab("help") },
    ]},
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-primary/10"><Settings className="w-7 h-7 text-primary" /></div>
          <h1 className="text-xl font-bold text-primary">Settings</h1>
        </div>
        {sections.map(section => (
          <div key={section.title} className="mb-6">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">{section.title}</h2>
            <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
              {section.items.map(item => (
                <button key={item.label} onClick={item.action} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/50 transition-colors text-left">
                  <span className="text-primary">{item.icon}</span>
                  <span className="flex-1 text-sm text-foreground">{item.label}</span>
                  {item.subtitle && <span className="text-xs text-muted-foreground">{item.subtitle}</span>}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        ))}
        <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-4 bg-destructive/10 text-destructive font-medium rounded-xl">
          <LogOut className="w-5 h-5" /> Sign Out
        </button>
      </div>
    </div>
  );
};
export default SettingsPage;
