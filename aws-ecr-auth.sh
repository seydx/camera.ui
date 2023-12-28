export AWS_PROFILE=lemieux-unmanned-ecr
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 607765238356.dkr.ecr.us-east-1.amazonaws.com
