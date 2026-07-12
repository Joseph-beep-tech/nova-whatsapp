import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:rider_app/main.dart';

void main() {
  testWidgets('App boots to a screen without crashing', (WidgetTester tester) async {
    await tester.pumpWidget(const NovaGoRiderApp());
    await tester.pump();

    // Splash screen shows while auth status is being determined.
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });
}
