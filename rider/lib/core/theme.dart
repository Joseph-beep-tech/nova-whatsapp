import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// NovaGo brand colors — matches admin-portal's tailwind.config.js gold/charcoal
/// palette so the rider app feels like the same product family.
class AppColors {
  AppColors._();

  static const gold50 = Color(0xFFFDF9EE);
  static const gold100 = Color(0xFFF9F0D0);
  static const gold200 = Color(0xFFF3E09E);
  static const gold300 = Color(0xFFEACC68);
  static const gold400 = Color(0xFFE2B93D);
  static const gold500 = Color(0xFFC9A84C);
  static const gold600 = Color(0xFFB08A35);
  static const gold700 = Color(0xFF8D6B28);
  static const gold800 = Color(0xFF6E5221);
  static const gold900 = Color(0xFF52391A);

  static const charcoal = Color(0xFF15151C);
  static const surface = Color(0xFFF8F7F4);
  static const cardBorder = Color(0xFFE9E5DC);

  static const success = Color(0xFF059669);
  static const warning = Color(0xFFD97706);
  static const danger = Color(0xFFDC2626);
  static const info = Color(0xFF2563EB);

  static const statusOffline = Color(0xFF9CA3AF);
  static const statusAvailable = Color(0xFF059669);
  static const statusBusy = Color(0xFFD97706);
}

class AppTheme {
  AppTheme._();

  static ThemeData get light {
    final textTheme = GoogleFonts.interTextTheme();
    return ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: AppColors.surface,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.gold500,
        primary: AppColors.gold600,
        secondary: AppColors.gold400,
        error: AppColors.danger,
        surface: Colors.white,
      ),
      textTheme: textTheme.apply(
        bodyColor: const Color(0xFF1F2937),
        displayColor: const Color(0xFF111827),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.surface,
        foregroundColor: const Color(0xFF111827),
        elevation: 0,
        centerTitle: false,
        titleTextStyle: GoogleFonts.inter(
          fontSize: 20,
          fontWeight: FontWeight.w700,
          color: const Color(0xFF111827),
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: const BorderSide(color: AppColors.cardBorder),
        ),
        margin: EdgeInsets.zero,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.gold500,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600),
          elevation: 0,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: const Color(0xFF374151),
          side: const BorderSide(color: AppColors.cardBorder),
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.cardBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.cardBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.gold500, width: 1.5),
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: Colors.white,
        selectedItemColor: AppColors.gold600,
        unselectedItemColor: Color(0xFF9CA3AF),
        showUnselectedLabels: true,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
      ),
      dividerTheme: const DividerThemeData(color: AppColors.cardBorder, thickness: 1),
    );
  }
}
