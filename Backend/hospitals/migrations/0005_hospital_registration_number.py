from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("hospitals", "0004_hospitalstaff_photo_data"),
    ]

    operations = [
        migrations.AddField(
            model_name="hospital",
            name="registration_number",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
    ]
