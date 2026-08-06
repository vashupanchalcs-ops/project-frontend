from django.db import migrations, models


def fill_ambulance_contract_id(apps, schema_editor):
    Ambulance = apps.get_model("ambulance", "Ambulance")
    for a in Ambulance.objects.all():
        if not (a.ambulance_contract_id or "").strip():
            a.ambulance_contract_id = f"AMB-ID-{int(a.id):04d}"
            a.save(update_fields=["ambulance_contract_id"])


class Migration(migrations.Migration):

    dependencies = [
        ("ambulance", "0010_ambulance_registration_number"),
    ]

    operations = [
        migrations.AddField(
            model_name="ambulance",
            name="ambulance_contract_id",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.RunPython(fill_ambulance_contract_id, migrations.RunPython.noop),
    ]

