from django.db import migrations, models


def fill_hospital_contract_id(apps, schema_editor):
    Hospital = apps.get_model("hospitals", "Hospital")
    for h in Hospital.objects.all():
        if not (h.hospital_contract_id or "").strip():
            h.hospital_contract_id = f"HOSP-ID-{int(h.id):04d}"
            h.save(update_fields=["hospital_contract_id"])


class Migration(migrations.Migration):

    dependencies = [
        ("hospitals", "0005_hospital_registration_number"),
    ]

    operations = [
        migrations.AddField(
            model_name="hospital",
            name="hospital_contract_id",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.RunPython(fill_hospital_contract_id, migrations.RunPython.noop),
    ]

