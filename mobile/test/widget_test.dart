import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('renders a basic scaffold', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Center(
            child: Text('Flutter login slice is ready'),
          ),
        ),
      ),
    );

    expect(find.text('Flutter login slice is ready'), findsOneWidget);
  });
}
