from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("hospitals", "0006_hospital_hospital_contract_id"),
    ]

    operations = [
        migrations.AddField(
            model_name="hospitalstaff",
            name="banner_data",
            field=models.TextField(blank=True, default=""),
        ),
    ]

