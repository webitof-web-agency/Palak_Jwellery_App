import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/theme/app_theme.dart';
import '../../batches/presentation/widgets/batch_ui.dart';
import '../data/capture_session_repository.dart';

class CreateSessionScreen extends ConsumerStatefulWidget {
  const CreateSessionScreen({super.key});

  @override
  ConsumerState<CreateSessionScreen> createState() => _CreateSessionScreenState();
}

class _CreateSessionScreenState extends ConsumerState<CreateSessionScreen> {
  final _formKey = GlobalKey<FormState>();
  final _customerNameController = TextEditingController();
  final _customerPhoneController = TextEditingController();
  final _referenceNoteController = TextEditingController();

  bool _saving = false;

  @override
  void dispose() {
    _customerNameController.dispose();
    _customerPhoneController.dispose();
    _referenceNoteController.dispose();
    super.dispose();
  }

  InputDecoration _fieldDecoration({
    required String label,
    required String hint,
    IconData? icon,
  }) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      prefixIcon: icon == null ? null : Icon(icon),
    );
  }

  Future<void> _submit() async {
    if (_saving) return;

    final valid = _formKey.currentState?.validate() ?? false;
    if (!valid) return;

    setState(() {
      _saving = true;
    });

    try {
      final createdSession = await ref.read(captureSessionRepositoryProvider).createSession(
            customerName: _customerNameController.text,
            customerPhone: _customerPhoneController.text,
            referenceNote: _referenceNoteController.text,
          );

      if (!mounted) {
        return;
      }

      final sessionId = createdSession.id;
      if (sessionId.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Session created, but no session id was returned.')),
        );
        return;
      }

      Navigator.of(context).pop(sessionId);
    } on CaptureSessionApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) {
        setState(() {
          _saving = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(themeControllerProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Create Session')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.warningSoft,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(
                      color: AppColors.warning.withValues(alpha: 0.22),
                    ),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.info_outline_rounded, color: AppColors.warning),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Capture sessions are for requests that include items from multiple suppliers. The assigned salesman is handled automatically.',
                          style: TextStyle(
                            color: AppColors.textPrimary,
                            height: 1.5,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                BatchSectionCard(
                  title: 'Session details',
                  subtitle: 'Optional customer details help identify the request later.',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      TextFormField(
                        controller: _customerNameController,
                        textInputAction: TextInputAction.next,
                        decoration: _fieldDecoration(
                          label: 'Customer name',
                          hint: 'Optional',
                          icon: Icons.person_rounded,
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _customerPhoneController,
                        textInputAction: TextInputAction.next,
                        keyboardType: TextInputType.phone,
                        decoration: _fieldDecoration(
                          label: 'Customer phone',
                          hint: 'Optional',
                          icon: Icons.phone_rounded,
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _referenceNoteController,
                        textInputAction: TextInputAction.newline,
                        maxLines: 3,
                        decoration: _fieldDecoration(
                          label: 'Reference note',
                          hint: 'Optional note for this session',
                          icon: Icons.note_alt_rounded,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton.icon(
                    onPressed: _saving ? null : _submit,
                    icon: _saving
                        ? SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: AppColors.accentOn,
                            ),
                          )
                        : const Icon(Icons.check_circle_outline_rounded),
                    label: Text(_saving ? 'Creating...' : 'Create Session'),
                  ),
                ),
                const SizedBox(height: 18),
                Text(
                  'After creation, open the session to add supplier batches from the mobile app.',
                  style: TextStyle(color: AppColors.textMuted, height: 1.5),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
