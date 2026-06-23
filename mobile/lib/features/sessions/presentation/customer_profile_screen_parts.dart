part of 'customer_profile_screen.dart';

class _EditCustomerSheet extends StatefulWidget {
  const _EditCustomerSheet({
    required this.customer,
    required this.onSave,
  });

  final CustomerRecord customer;
  final ValueChanged<CustomerRecord> onSave;

  @override
  State<_EditCustomerSheet> createState() => _EditCustomerSheetState();
}

class _EditCustomerSheetState extends State<_EditCustomerSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _phoneController;
  late final TextEditingController _areaController;
  late final TextEditingController _emailController;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.customer.name);
    _phoneController = TextEditingController(text: _normalizedPhoneDigits(widget.customer.phone));
    _areaController = TextEditingController(text: widget.customer.area);
    _emailController = TextEditingController(text: widget.customer.email ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _areaController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  String _normalizedPhoneDigits(String value) {
    final digits = value.replaceAll(RegExp(r'\D'), '');
    if (digits.length > 10) {
      return digits.substring(digits.length - 10);
    }
    return digits;
  }

  String? _validatePhone(String? value) {
    final digits = _normalizedPhoneDigits(value ?? '');
    if (digits.isEmpty) {
      return 'Phone is required';
    }
    if (digits.length != 10) {
      return 'Enter a 10-digit phone number';
    }
    return null;
  }
  String? _validateEmail(String? value) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) {
      return null;
    }
    if (!text.contains('@') || !text.contains('.')) {
      return 'Enter a valid email';
    }
    return null;
  }

  void _save() {
    final form = _formKey.currentState;
    if (form == null || !form.validate()) {
      return;
    }

    final updated = CustomerRecord(
      id: widget.customer.id,
      name: _nameController.text.trim(),
      phone: _normalizedPhoneDigits(_phoneController.text),
      area: _areaController.text.trim(),
      email: _emailController.text.trim().isEmpty ? null : _emailController.text.trim(),
      isRecent: widget.customer.isRecent,
      lastSeenLabel: widget.customer.lastSeenLabel,
    );

    widget.onSave(updated);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
          border: Border.all(color: AppColors.border),
        ),
        child: SafeArea(
          top: false,
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.screenPadding,
              AppSpacing.lg,
              AppSpacing.screenPadding,
              AppSpacing.screenPadding,
            ),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 44,
                      height: 5,
                      decoration: BoxDecoration(
                        color: AppColors.borderStrong,
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  const AppSectionHeader(
                    title: 'Edit Customer',
                    subtitle: 'Update customer details for all their local sessions.',
                  ),
                  const SizedBox(height: AppSpacing.md),
                  AppBanner(
                    title: 'Required fields',
                    message: 'Name, phone, and area/location are required. Email is optional.',
                    tone: AppBannerTone.info,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  TextFormField(
                    controller: _nameController,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(
                      labelText: 'Name',
                      hintText: 'Customer name',
                      prefixIcon: Icon(Icons.person_rounded),
                    ),
                    validator: (value) {
                      if ((value ?? '').trim().isEmpty) {
                        return 'Name is required';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: AppSpacing.md),
                  TextFormField(
                    controller: _phoneController,
                    keyboardType: TextInputType.phone,
                    textInputAction: TextInputAction.next,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(10),
                    ],
                    decoration: const InputDecoration(
                      labelText: 'Phone',
                      hintText: 'Customer phone',
                      prefixIcon: Icon(Icons.phone_rounded),
                    ),
                    validator: _validatePhone,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  TextFormField(
                    controller: _areaController,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(
                      labelText: 'Area / location',
                      hintText: 'Area, locality, or city',
                      prefixIcon: Icon(Icons.place_rounded),
                    ),
                    validator: (value) {
                      if ((value ?? '').trim().isEmpty) {
                        return 'Area/location is required';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: AppSpacing.md),
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.done,
                    decoration: const InputDecoration(
                      labelText: 'Email',
                      hintText: 'Optional email address',
                      prefixIcon: Icon(Icons.email_rounded),
                    ),
                    validator: _validateEmail,
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  Row(
                    children: [
                      Expanded(
                        child: AppActionButton(
                          label: 'Cancel',
                          onPressed: () => Navigator.of(context).pop(),
                          variant: AppActionButtonVariant.secondary,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: AppActionButton(
                          label: 'Save Changes',
                          onPressed: _save,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}





